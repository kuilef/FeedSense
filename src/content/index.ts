import { ActionDecision, BgResponse, PostSignals, SettingsV1 } from "../shared/contracts";
import { CMF_FOLLOW_DICTIONARY } from "./cmfCore";
import { DecisionApplier } from "./decisionApplier";
import { FacebookFeedLocator } from "./feedLocator";
import { sendBgRequest } from "./messaging/bgClient";
import { ObserverController } from "./observerController";
import { FacebookUnitExtractor } from "./unitExtractor";
import { FacebookUnitLocator } from "./unitLocator";

interface FeedSenseDebugSnapshot {
  href: string;
  rootFound: boolean;
  totalUnits: number;
  queuedUnits: number;
  lastBatchSize: number;
  processedCount: number;
  runs: number;
  lastError: string;
  note: string;
}

declare global {
  interface Window {
    __FB_CLEAN_DEBUG_BUILD__?: boolean;
    __feedsenseDebug?: {
      status: () => FeedSenseDebugSnapshot;
      processNow: () => void;
      locateRoot: () => HTMLElement | null;
      locateUnits: () => HTMLElement[];
      decisions: () => Array<{
        hash: string;
        state: string;
        reason: string;
        source: string;
      }>;
    };
  }
}

let processed = new WeakSet<HTMLElement>();
const feedLocator = new FacebookFeedLocator();
const unitLocator = new FacebookUnitLocator();
const unitExtractor = new FacebookUnitExtractor();
const observer = new ObserverController();
const applier = new DecisionApplier();
let extensionContextInvalidated = false;
const DEBUG =
  window.__FB_CLEAN_DEBUG_BUILD__ === true ||
  window.localStorage.getItem("fbclean.debug") === "1" ||
  new URLSearchParams(window.location.search).get("fbclean_debug") === "1";

const debugState = {
  rootFound: false,
  totalUnits: 0,
  queuedUnits: 0,
  lastBatchSize: 0,
  processedCount: 0,
  runs: 0,
  lastError: "",
  note: "booting"
};
const DEBUG_STATE_NODE_ID = "fbclean-debug-state";
const DEBUG_BADGE_ID = "fbclean-debug-badge";
const MAX_KEEP_REEVALS = 4;
const KEEP_REEVAL_DELAY_MS = 450;
const RULES_CACHE_TTL_MS = 10_000;
const FINGERPRINT_TEXT_LIMIT = 6000;
const FINGERPRINT_INTERACTIVE_LIMIT = 80;
const FOLLOW_SWEEP_MAX_CANDIDATES = 2000;
const FINGERPRINT_SELECTOR =
  'button, [role="button"], a[role="link"], a[href], [aria-label], [aria-description], [title], [data-tooltip-content]';
const FEED_UNIT_CONTAINER_SELECTORS = [
  '[role="article"]',
  'div[data-pagelet*="FeedUnit" i]',
  'div[aria-posinset]',
  'div[aria-describedby]'
] as const;
const INVISIBLE_TEXT_CHARS = /[\u200B-\u200F\u2060\uFEFF]/g;
const normalizeSourceName = (name: string | undefined): string => name?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
type RuntimeRules = Pick<
  SettingsV1["rules"],
  "hideSponsored" | "hideSuggested" | "collapseReels" | "hideFollowMarked" | "allowSources"
>;
const runtimeRules: RuntimeRules = {
  hideSponsored: true,
  hideSuggested: false,
  collapseReels: true,
  hideFollowMarked: true,
  allowSources: []
};
let rulesFetchedAt = 0;

const debugLog = (...args: unknown[]) => {
  if (!DEBUG) {
    return;
  }
  console.info("[FeedSense]", ...args);
};

const debugWarn = (...args: unknown[]) => {
  if (!DEBUG) {
    return;
  }
  console.warn("[FeedSense]", ...args);
};

const collectAppliedDecisions = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-fbclean-processed="1"]')).map((unit) => ({
    hash: unit.dataset.fbcleanHash ?? "",
    state: unit.dataset.fbcleanState ?? "",
    reason: unit.dataset.fbcleanReason ?? "",
    source: unit.dataset.fbcleanSource ?? ""
  }));

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `${hash}`;
};

const normalizeForFingerprint = (value: string): string =>
  value.normalize("NFKC").replace(INVISIBLE_TEXT_CHARS, "").replace(/\s+/g, " ").trim().toLowerCase();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const matchesTokenBoundary = (text: string, token: string): boolean => {
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(token)}($|[^\\p{L}\\p{N}])`, "iu");
  return pattern.test(text);
};

const matchesSpacedAsciiToken = (text: string, token: string): boolean => {
  const sequence = token
    .split("")
    .map((char) => escapeRegExp(char))
    .join("[\\s\\p{P}\\p{S}]+");
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${sequence}($|[^\\p{L}\\p{N}])`, "iu");
  return pattern.test(text);
};

const hasFollowToken = (value: string): boolean => {
  const normalized = normalizeForFingerprint(value);
  if (!normalized) {
    return false;
  }

  for (let i = 0; i < CMF_FOLLOW_DICTIONARY.length; i += 1) {
    const token = CMF_FOLLOW_DICTIONARY[i];
    if (/^[a-z]+$/i.test(token)) {
      if (matchesTokenBoundary(normalized, token) || matchesSpacedAsciiToken(normalized, token)) {
        return true;
      }
      continue;
    }
    if (normalized.includes(token) || matchesTokenBoundary(normalized, token)) {
      return true;
    }
  }

  return false;
};

const isFollowCtaElement = (element: HTMLElement): boolean => {
  const texts = [
    element.textContent ?? "",
    element.getAttribute("aria-label") ?? "",
    element.getAttribute("aria-description") ?? "",
    element.getAttribute("title") ?? "",
    element.getAttribute("data-tooltip-content") ?? ""
  ];
  return texts.some((value) => hasFollowToken(value));
};

const findFeedUnitContainer = (element: HTMLElement, root: HTMLElement): HTMLElement | null => {
  for (let i = 0; i < FEED_UNIT_CONTAINER_SELECTORS.length; i += 1) {
    const container = element.closest<HTMLElement>(FEED_UNIT_CONTAINER_SELECTORS[i]);
    if (!container || !root.contains(container)) {
      continue;
    }
    return container.closest<HTMLElement>('[role="article"]') ?? container;
  }
  return null;
};

const getUnitFingerprint = (unit: HTMLElement): string => {
  const chunks: string[] = [];
  chunks.push(normalizeForFingerprint(unit.innerText || unit.textContent || "").slice(0, 2500));
  chunks.push(normalizeForFingerprint(unit.getAttribute("aria-label") ?? ""));
  chunks.push(normalizeForFingerprint(unit.getAttribute("aria-description") ?? ""));
  chunks.push(normalizeForFingerprint(unit.getAttribute("title") ?? ""));

  const interactive = unit.querySelectorAll<HTMLElement>(FINGERPRINT_SELECTOR);
  const max = Math.min(interactive.length, FINGERPRINT_INTERACTIVE_LIMIT);
  for (let i = 0; i < max; i += 1) {
    const el = interactive[i];
    const text = normalizeForFingerprint(el.textContent ?? "").slice(0, 80);
    const ariaLabel = normalizeForFingerprint(el.getAttribute("aria-label") ?? "").slice(0, 80);
    const ariaDescription = normalizeForFingerprint(el.getAttribute("aria-description") ?? "").slice(0, 80);
    const title = normalizeForFingerprint(el.getAttribute("title") ?? "").slice(0, 80);
    const tooltip = normalizeForFingerprint(el.getAttribute("data-tooltip-content") ?? "").slice(0, 80);
    chunks.push(`${el.tagName}|${text}|${ariaLabel}|${ariaDescription}|${title}|${tooltip}`);
  }

  const normalized = chunks.join("\n").slice(0, FINGERPRINT_TEXT_LIMIT);
  return `${hashString(normalized)}:${normalized.length}`;
};

const hasUnitFingerprintChanged = (unit: HTMLElement): boolean => {
  const nextFingerprint = getUnitFingerprint(unit);
  const prevFingerprint = unit.dataset.fbcleanFingerprint ?? "";
  unit.dataset.fbcleanFingerprint = nextFingerprint;
  return prevFingerprint !== nextFingerprint;
};

const sweepAndHideFollowUnits = (root: HTMLElement): number => {
  const elements = root.querySelectorAll<HTMLElement>(FINGERPRINT_SELECTOR);
  const max = Math.min(elements.length, FOLLOW_SWEEP_MAX_CANDIDATES);
  const hidden = new Set<HTMLElement>();

  for (let i = 0; i < max; i += 1) {
    const element = elements[i];
    if (!isFollowCtaElement(element)) {
      continue;
    }

    const unit = findFeedUnitContainer(element, root);
    if (!unit || hidden.has(unit) || unit.dataset.fbcleanState === "hide") {
      continue;
    }

    const textLength = normalizeForFingerprint(unit.innerText || unit.textContent || "").length;
    if (textLength < 25) {
      continue;
    }

    const decision: ActionDecision = {
      action: "HIDE",
      confidence: 1,
      reasonCodes: ["DIRECT_FOLLOW_CTA_SWEEP"]
    };
    applier.apply(unit, decision, decision.reasonCodes.join(","));
    unit.dataset.fbcleanKeepScans = "0";
    unit.dataset.fbcleanFingerprint = getUnitFingerprint(unit);
    processed.add(unit);
    debugState.processedCount += 1;
    hidden.add(unit);
  }

  return hidden.size;
};

const getKeepReevalCount = (unit: HTMLElement): number => {
  const value = Number.parseInt(unit.dataset.fbcleanKeepScans ?? "0", 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const incrementKeepReevalCount = (unit: HTMLElement): number => {
  const next = getKeepReevalCount(unit) + 1;
  unit.dataset.fbcleanKeepScans = String(next);
  return next;
};

const isExtensionContextInvalidatedError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("extension context invalidated");
};

const handleExtensionContextInvalidated = () => {
  if (extensionContextInvalidated) {
    return;
  }
  extensionContextInvalidated = true;
  observer.stop();
  debugState.lastError = "Extension context invalidated. Reload the page after reloading extension.";
  updateDebugPanel("context-invalidated");
  debugWarn("Extension context invalidated. Stop processing until page reload.");
};

const refreshRuntimeRules = async () => {
  if (Date.now() - rulesFetchedAt < RULES_CACHE_TTL_MS) {
    return;
  }

  rulesFetchedAt = Date.now();
  try {
    const response = await sendBgRequest<BgResponse>({ type: "GET_SETTINGS" });
    if (response.type !== "SETTINGS") {
      return;
    }
    runtimeRules.hideSponsored = response.value.rules.hideSponsored !== false;
    runtimeRules.hideSuggested = response.value.rules.hideSuggested === true;
    runtimeRules.collapseReels = response.value.rules.collapseReels !== false;
    runtimeRules.hideFollowMarked = response.value.rules.hideFollowMarked !== false;
    runtimeRules.allowSources = response.value.rules.allowSources;
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      handleExtensionContextInvalidated();
      return;
    }
    debugWarn("failed to refresh runtime rules", error);
  }
};

const isAllowlistedSource = (signals: PostSignals): boolean => {
  const sourceName = normalizeSourceName(signals.sourceName);
  if (!sourceName) {
    return false;
  }
  return runtimeRules.allowSources.some((source) => normalizeSourceName(source.name) === sourceName);
};

const getDirectDecision = (signals: PostSignals): ActionDecision | null => {
  if (isAllowlistedSource(signals)) {
    return null;
  }
  if (runtimeRules.hideSponsored && signals.isSponsored) {
    return { action: "HIDE", confidence: 1, reasonCodes: ["DIRECT_SPONSORED_MARKER"] };
  }
  if (runtimeRules.hideFollowMarked && signals.isFollowMarked) {
    return { action: "HIDE", confidence: 1, reasonCodes: ["DIRECT_FOLLOW_MARKER"] };
  }
  if (runtimeRules.hideSuggested && signals.isSuggested) {
    return { action: "HIDE", confidence: 1, reasonCodes: ["DIRECT_SUGGESTED_MARKER"] };
  }
  if (runtimeRules.collapseReels && signals.isReel) {
    return { action: "COLLAPSE", confidence: 0.95, reasonCodes: ["DIRECT_REELS_MARKER"] };
  }
  return null;
};

const getDebugSnapshot = (): FeedSenseDebugSnapshot => {
  return {
    href: window.location.href,
    rootFound: debugState.rootFound,
    totalUnits: debugState.totalUnits,
    queuedUnits: debugState.queuedUnits,
    lastBatchSize: debugState.lastBatchSize,
    processedCount: debugState.processedCount,
    runs: debugState.runs,
    lastError: debugState.lastError,
    note: debugState.note
  };
};

const publishDebugSnapshot = () => {
  if (!DEBUG || !document.documentElement) {
    return;
  }

  let node = document.getElementById(DEBUG_STATE_NODE_ID);
  if (!node) {
    node = document.createElement("div");
    node.id = DEBUG_STATE_NODE_ID;
    node.style.display = "none";
    document.documentElement.append(node);
  }

  node.setAttribute("data-json", JSON.stringify(getDebugSnapshot()));
};

const updateDebugPanel = (note: string) => {
  if (!DEBUG) {
    return;
  }

  debugState.note = note;
  publishDebugSnapshot();
  const panel = document.getElementById("fbclean-debug-panel");
  if (!panel) {
    return;
  }

  const data = getDebugSnapshot();
  panel.textContent = [
    "FeedSense DEBUG",
    `root:${data.rootFound ? "yes" : "no"}`,
    `units:${data.totalUnits}`,
    `queue:${data.queuedUnits}`,
    `batch:${data.lastBatchSize}`,
    `processed:${data.processedCount}`,
    `runs:${data.runs}`,
    `note:${data.note}`,
    data.lastError ? `error:${data.lastError}` : "error:-"
  ].join(" | ");
};

const injectStyles = () => {
  if (document.getElementById("fbclean-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "fbclean-style";
  style.textContent = `
  .fbclean-hide { display: none !important; }
  .fbclean-collapse { max-height: 64px; overflow: hidden; position: relative; }
  .fbclean-collapse::after { content: "Свернуто FeedSense"; position: absolute; bottom: 0; right: 0; background: #fff; padding: 2px 8px; font-size: 11px; }
  .fbclean-debug-panel {
    position: fixed;
    left: 8px;
    bottom: 8px;
    z-index: 2147483647;
    background: rgba(17, 24, 39, 0.92);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 6px 8px;
    font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    max-width: min(92vw, 920px);
    white-space: normal;
    pointer-events: none;
  }
  .fbclean-debug-badge {
    position: fixed;
    top: 8px;
    right: 8px;
    z-index: 2147483647;
    background: #0f766e;
    color: #fff;
    border-radius: 999px;
    padding: 6px 10px;
    font: 600 12px/1 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    pointer-events: none;
  }
  `;
  document.head.append(style);

  if (DEBUG) {
    if (!document.body) {
      return;
    }

    if (!document.getElementById("fbclean-debug-panel")) {
      const panel = document.createElement("div");
      panel.id = "fbclean-debug-panel";
      panel.className = "fbclean-debug-panel";
      document.body.append(panel);
      updateDebugPanel("panel-ready");
    }

    if (!document.getElementById(DEBUG_BADGE_ID)) {
      const badge = document.createElement("div");
      badge.id = DEBUG_BADGE_ID;
      badge.className = "fbclean-debug-badge";
      badge.textContent = "FeedSense DEBUG ACTIVE";
      document.body.append(badge);
    }
  }
};

const processBatch = async () => {
  if (extensionContextInvalidated) {
    return;
  }

  debugState.runs += 1;
  const root = feedLocator.locateFeedRoot(document);
  debugState.rootFound = Boolean(root);

  if (!root) {
    updateDebugPanel("no-root");
    debugLog("feed root not found", { href: location.href });
    return;
  }

  await refreshRuntimeRules();
  if (extensionContextInvalidated) {
    return;
  }

  const sweptHidden = runtimeRules.hideFollowMarked ? sweepAndHideFollowUnits(root) : 0;
  const locatedUnits = unitLocator.locateUnits(root);
  const units = locatedUnits.filter((unit) => {
    if (processed.has(unit) || unit.dataset.fbcleanProcessed === "1") {
      return false;
    }

    const scans = getKeepReevalCount(unit);
    if (scans >= MAX_KEEP_REEVALS) {
      if (!hasUnitFingerprintChanged(unit)) {
        return false;
      }
      unit.dataset.fbcleanKeepScans = "0";
    }

    return true;
  });
  const batch = units.slice(0, 20);
  debugState.totalUnits = locatedUnits.length;
  debugState.queuedUnits = units.length;
  debugState.lastBatchSize = batch.length;

  if (!batch.length) {
    updateDebugPanel(sweptHidden > 0 ? `sweep:${sweptHidden}` : "empty-batch");
    if (sweptHidden > 0) {
      debugLog("follow sweep hid units", { hidden: sweptHidden });
    }
    return;
  }

  const signalsByUnit = new Map<string, HTMLElement>();
  const itemByUnitId = new Map<string, PostSignals>();
  const items: PostSignals[] = [];
  let applied = 0;
  const actionCounts: Record<string, number> = {};
  const decisionSamples: Array<{
    unitId: string;
    action: string;
    reasonCodes: string[];
    sourceName: string;
    state: string;
  }> = [];

  const recordDecision = (unit: HTMLElement, signals: PostSignals, decision: ActionDecision) => {
    applied += 1;
    unit.dataset.fbcleanHash = signals.canonicalHash;
    unit.dataset.fbcleanSource = signals.sourceName ?? "";
    applier.apply(unit, decision, decision.reasonCodes.join(","));
    const action = decision.action;
    actionCounts[action] = (actionCounts[action] ?? 0) + 1;
    decisionSamples.push({
      unitId: signals.unitId,
      action,
      reasonCodes: decision.reasonCodes,
      sourceName: signals.sourceName ?? "(unknown)",
      state: unit.dataset.fbcleanState ?? "unknown"
    });
  };

  for (const unit of batch) {
    const signals = unitExtractor.extract(unit);
    unit.dataset.fbcleanFingerprint = getUnitFingerprint(unit);
    const directDecision = getDirectDecision(signals);
    if (directDecision) {
      processed.add(unit);
      unit.dataset.fbcleanKeepScans = "0";
      debugState.processedCount += 1;
      recordDecision(unit, signals, directDecision);
      continue;
    }
    signalsByUnit.set(signals.unitId, unit);
    itemByUnitId.set(signals.unitId, signals);
    items.push(signals);
  }

  let hasPendingKeepReeval = false;
  if (!items.length) {
    debugState.lastError = "";
    updateDebugPanel(`ok:${applied}`);
    debugLog("batch processed directly", {
      locatedUnits: locatedUnits.length,
      queuedUnits: units.length,
      batchSize: batch.length,
      applied,
      actionCounts,
      decisions: decisionSamples
    });

    if (applied > 0 && units.length > batch.length) {
      window.setTimeout(() => {
        void processBatch();
      }, 50);
    }
    return;
  }

  let response: BgResponse;
  try {
    response = await sendBgRequest<BgResponse>({ type: "EVALUATE_BATCH", items, settingsVersion: 1 });
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      handleExtensionContextInvalidated();
      return;
    }
    debugState.lastError = error instanceof Error ? error.message : String(error);
    updateDebugPanel("background-error");
    debugWarn("sendBgRequest failed", error);
    return;
  }

  if (response.type !== "EVALUATE_BATCH_RESULT") {
    updateDebugPanel("unexpected-response");
    return;
  }

  for (const result of response.results) {
    const unit = signalsByUnit.get(result.unitId);
    if (!unit) {
      continue;
    }
    const item = itemByUnitId.get(result.unitId);
    const decision = result.outcome.action as ActionDecision;
    const action = decision.action;

    applied += 1;
    unit.dataset.fbcleanHash = item?.canonicalHash ?? "";
    unit.dataset.fbcleanSource = item?.sourceName ?? "";
    applier.apply(unit, decision, decision.reasonCodes.join(","));

    if (action === "KEEP") {
      const scanCount = incrementKeepReevalCount(unit);
      if (scanCount < MAX_KEEP_REEVALS) {
        hasPendingKeepReeval = true;
      }
    } else {
      processed.add(unit);
      unit.dataset.fbcleanKeepScans = "0";
      debugState.processedCount += 1;
    }

    actionCounts[action] = (actionCounts[action] ?? 0) + 1;
    decisionSamples.push({
      unitId: result.unitId,
      action,
      reasonCodes: decision.reasonCodes,
      sourceName: item?.sourceName ?? "(unknown)",
      state: unit.dataset.fbcleanState ?? "unknown"
    });
  }

  debugState.lastError = "";
  updateDebugPanel(`ok:${applied}`);
  debugLog("batch processed", {
    locatedUnits: locatedUnits.length,
    queuedUnits: units.length,
    batchSize: batch.length,
    applied,
    actionCounts,
    decisions: decisionSamples
  });

  if (applied > 0 && units.length > batch.length) {
    window.setTimeout(() => {
      void processBatch();
    }, 50);
  }

  if (hasPendingKeepReeval) {
    window.setTimeout(() => {
      void processBatch();
    }, KEEP_REEVAL_DELAY_MS);
  }
};

const bootstrap = () => {
  injectStyles();
  const root = feedLocator.locateFeedRoot(document);
  debugState.rootFound = Boolean(root);
  if (!root) {
    updateDebugPanel("bootstrap-waiting-root");
    window.setTimeout(bootstrap, 800);
    return;
  }

  observer.start(root, () => {
    void processBatch();
  });

  updateDebugPanel("observer-started");
  void processBatch();
};

if (DEBUG) {
  window.__feedsenseDebug = {
    status: () => getDebugSnapshot(),
    processNow: () => {
      void processBatch();
    },
    locateRoot: () => feedLocator.locateFeedRoot(document),
    locateUnits: () => {
      const root = feedLocator.locateFeedRoot(document);
      return root ? unitLocator.locateUnits(root) : [];
    },
    decisions: () => collectAppliedDecisions()
  };
  window.addEventListener("feedsense:processNow", () => {
    void processBatch();
  });
  window.addEventListener("feedsense:status:request", () => {
    debugLog("status requested from page", getDebugSnapshot());
    publishDebugSnapshot();
  });
  publishDebugSnapshot();
  debugLog("debug mode enabled", {
    fromBuild: window.__FB_CLEAN_DEBUG_BUILD__ === true,
    fromStorage: window.localStorage.getItem("fbclean.debug") === "1",
    fromQuery: new URLSearchParams(window.location.search).get("fbclean_debug") === "1"
  });
}

let lastHref = location.href;
window.setInterval(() => {
  if (lastHref !== location.href) {
    lastHref = location.href;
    observer.stop();

    if (extensionContextInvalidated) {
      updateDebugPanel("context-invalidated");
      return;
    }

    processed = new WeakSet<HTMLElement>();
    updateDebugPanel("route-change");
    bootstrap();
  }
}, 1000);

bootstrap();
