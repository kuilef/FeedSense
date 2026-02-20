import { ActionDecision } from "../shared/contracts";

export class DecisionApplier {
  apply(unitEl: HTMLElement, decision: ActionDecision, debugReason?: string): void {
    unitEl.dataset.fbcleanProcessed = "1";

    switch (decision.action) {
      case "KEEP":
        unitEl.dataset.fbcleanState = "keep";
        break;
      case "HIDE":
        unitEl.classList.add("fbclean-hide");
        unitEl.dataset.fbcleanState = "hide";
        break;
      case "COLLAPSE":
        unitEl.classList.add("fbclean-collapse");
        unitEl.dataset.fbcleanState = "collapse";
        break;
      case "REPLACE_WITH_TLDR":
        unitEl.classList.add("fbclean-collapse");
        unitEl.dataset.fbcleanState = "tldr";
        break;
      default:
        unitEl.dataset.fbcleanState = "keep";
    }

    if (debugReason) {
      unitEl.dataset.fbcleanReason = debugReason;
    }
  }
}
