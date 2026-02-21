import { ActionDecision, BgResponse, PostSignals } from "../shared/contracts";
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
  `;
  document.head.append(style);

  if (DEBUG && !document.getElementById("fbclean-debug-panel")) {
    if (!document.body) {
      return;
    }
    const panel = document.createElement("div");
    panel.id = "fbclean-debug-panel";
    panel.className = "fbclean-debug-panel";
    document.body.append(panel);
    updateDebugPanel("panel-ready");
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

  const locatedUnits = unitLocator.locateUnits(root);
  const units = locatedUnits.filter((unit) => !processed.has(unit) && unit.dataset.fbcleanProcessed !== "1");
  const batch = units.slice(0, 20);
  debugState.totalUnits = locatedUnits.length;
  debugState.queuedUnits = units.length;
  debugState.lastBatchSize = batch.length;

  if (!batch.length) {
    updateDebugPanel("empty-batch");
    return;
  }

  const signalsByUnit = new Map<string, HTMLElement>();
  const itemByUnitId = new Map<string, PostSignals>();
  const items: PostSignals[] = batch.map((unit) => {
    const signals = unitExtractor.extract(unit);
    signalsByUnit.set(signals.unitId, unit);
    itemByUnitId.set(signals.unitId, signals);
    return signals;
  });

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

  let applied = 0;
  const actionCounts: Record<string, number> = {};
  const decisionSamples: Array<{
    unitId: string;
    action: string;
    reasonCodes: string[];
    sourceName: string;
    state: string;
  }> = [];
  for (const result of response.results) {
    const unit = signalsByUnit.get(result.unitId);
    if (!unit) {
      continue;
    }
    const item = itemByUnitId.get(result.unitId);

    processed.add(unit);
    debugState.processedCount += 1;
    applied += 1;
    unit.dataset.fbcleanHash = item?.canonicalHash ?? "";
    unit.dataset.fbcleanSource = item?.sourceName ?? "";
    applier.apply(unit, result.outcome.action as ActionDecision, result.outcome.action.reasonCodes.join(","));
    const action = result.outcome.action.action;
    actionCounts[action] = (actionCounts[action] ?? 0) + 1;
    decisionSamples.push({
      unitId: result.unitId,
      action,
      reasonCodes: result.outcome.action.reasonCodes,
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
    processed = new WeakSet<HTMLElement>();
    extensionContextInvalidated = false;
    updateDebugPanel("route-change");
    bootstrap();
  }
}, 1000);

bootstrap();
