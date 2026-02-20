import { ActionDecision, BgResponse, PostSignals } from "../shared/contracts";
import { DecisionApplier } from "./decisionApplier";
import { FacebookFeedLocator } from "./feedLocator";
import { sendBgRequest } from "./messaging/bgClient";
import { ObserverController } from "./observerController";
import { FacebookUnitExtractor } from "./unitExtractor";
import { FacebookUnitLocator } from "./unitLocator";

let processed = new WeakSet<HTMLElement>();
const feedLocator = new FacebookFeedLocator();
const unitLocator = new FacebookUnitLocator();
const unitExtractor = new FacebookUnitExtractor();
const observer = new ObserverController();
const applier = new DecisionApplier();

const injectStyles = () => {
  const style = document.createElement("style");
  style.textContent = `
  .fbclean-hide { display: none !important; }
  .fbclean-collapse { max-height: 64px; overflow: hidden; position: relative; }
  .fbclean-collapse::after { content: "Свернуто FeedSense"; position: absolute; bottom: 0; right: 0; background: #fff; padding: 2px 8px; font-size: 11px; }
  `;
  document.head.append(style);
};

const processBatch = async () => {
  const root = feedLocator.locateFeedRoot(document);
  if (!root) {
    return;
  }

  const units = unitLocator.locateUnits(root).filter((unit) => !processed.has(unit) && unit.dataset.fbcleanProcessed !== "1");
  const batch = units.slice(0, 20);

  if (!batch.length) {
    return;
  }

  const signalsByUnit = new Map<string, HTMLElement>();
  const items: PostSignals[] = batch.map((unit) => {
    const signals = unitExtractor.extract(unit);
    signalsByUnit.set(signals.unitId, unit);
    return signals;
  });

  const response = await sendBgRequest<BgResponse>({ type: "EVALUATE_BATCH", items, settingsVersion: 1 });
  if (response.type !== "EVALUATE_BATCH_RESULT") {
    return;
  }

  for (const result of response.results) {
    const unit = signalsByUnit.get(result.unitId);
    if (!unit) {
      continue;
    }

    processed.add(unit);
    unit.dataset.fbcleanHash = items.find((entry) => entry.unitId === result.unitId)?.canonicalHash;
    applier.apply(unit, result.outcome.action as ActionDecision, result.outcome.action.reasonCodes.join(","));
  }
};

const bootstrap = () => {
  injectStyles();
  const root = feedLocator.locateFeedRoot(document);
  if (!root) {
    window.setTimeout(bootstrap, 800);
    return;
  }

  observer.start(root, () => {
    void processBatch();
  });

  void processBatch();
};

let lastHref = location.href;
window.setInterval(() => {
  if (lastHref !== location.href) {
    lastHref = location.href;
    observer.stop();
    processed = new WeakSet<HTMLElement>();
    bootstrap();
  }
}, 1000);

bootstrap();
