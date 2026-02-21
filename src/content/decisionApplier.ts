import { ActionDecision } from "../shared/contracts";

export class DecisionApplier {
  apply(unitEl: HTMLElement, decision: ActionDecision, debugReason?: string): void {
    unitEl.classList.remove("fbclean-hide", "fbclean-collapse", "fbclean-pending");
    unitEl.dataset.fbcleanPending = "0";

    switch (decision.action) {
      case "KEEP":
        unitEl.dataset.fbcleanProcessed = "0";
        unitEl.dataset.fbcleanState = "keep";
        break;
      case "HIDE":
        unitEl.classList.add("fbclean-hide");
        unitEl.dataset.fbcleanProcessed = "1";
        unitEl.dataset.fbcleanState = "hide";
        break;
      case "COLLAPSE":
        unitEl.classList.add("fbclean-collapse");
        unitEl.dataset.fbcleanProcessed = "1";
        unitEl.dataset.fbcleanState = "collapse";
        break;
      case "REPLACE_WITH_TLDR":
        unitEl.classList.add("fbclean-collapse");
        unitEl.dataset.fbcleanProcessed = "1";
        unitEl.dataset.fbcleanState = "tldr";
        break;
      default:
        unitEl.dataset.fbcleanProcessed = "0";
        unitEl.dataset.fbcleanState = "keep";
    }

    if (debugReason) {
      unitEl.dataset.fbcleanReason = debugReason;
    }
  }
}
