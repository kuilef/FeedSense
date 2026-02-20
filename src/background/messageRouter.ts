import { BgRequest, BgResponse, PostSignals } from "../shared/contracts";
import { CacheStore } from "./cache/cacheStore";
import { DefaultPolicyEngine } from "./policy/policyEngine";
import { SettingsStore } from "./settings/settingsStore";

export class MessageRouter {
  private settingsStore = new SettingsStore();
  private policyEngine = new DefaultPolicyEngine();
  private cacheStore = new CacheStore();

  register(): void {
    chrome.runtime.onMessage.addListener((request: BgRequest, _sender: any, sendResponse: (response: BgResponse) => void) => {
      this.handle(request)
        .then((response) => sendResponse(response))
        .catch(() =>
          sendResponse({
            type: "EVALUATE_BATCH_RESULT",
            results: []
          } satisfies BgResponse)
        );
      return true;
    });
  }

  private async handle(request: BgRequest): Promise<BgResponse> {
    switch (request.type) {
      case "GET_SETTINGS": {
        const settings = await this.settingsStore.get();
        return { type: "SETTINGS", value: settings };
      }
      case "EVALUATE_BATCH": {
        const settings = await this.settingsStore.get();
        const results = await this.evaluateItems(request.items, settings.schemaVersion);
        return { type: "EVALUATE_BATCH_RESULT", results };
      }
      case "REQUEST_TLDR": {
        return {
          type: "TLDR_RESULT",
          canonicalHash: request.canonicalHash,
          tldr: null,
          reasonCodes: ["TLDR_NOT_IMPLEMENTED"]
        };
      }
      case "USER_OVERRIDE":
      default:
        return {
          type: "TLDR_RESULT",
          canonicalHash: request.type === "USER_OVERRIDE" ? request.canonicalHash : "",
          tldr: null,
          reasonCodes: ["OVERRIDE_ACCEPTED"]
        };
    }
  }

  private async evaluateItems(items: PostSignals[], settingsVersion: number) {
    const settings = await this.settingsStore.get();
    const map = await this.policyEngine.evaluateBatch(items, settings);

    const results: Array<{ unitId: string; outcome: Awaited<ReturnType<DefaultPolicyEngine["evaluateOne"]>> }> = [];
    for (const item of items) {
      const key = `${item.canonicalHash}:${settingsVersion}`;
      const outcome = map.get(item.unitId);
      if (!outcome) {
        continue;
      }
      await this.cacheStore.putDecision(key, outcome);
      results.push({ unitId: item.unitId, outcome });
    }
    return results;
  }
}
