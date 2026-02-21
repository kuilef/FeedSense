import { ActionDecision, PolicyOutcome, PostLabel, PostSignals, SettingsV1 } from "../../shared/contracts";

const normalizeSourceName = (name: string | undefined): string => name?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";

export interface PolicyEngine {
  evaluateOne(signals: PostSignals, settings: SettingsV1): Promise<PolicyOutcome>;
  evaluateBatch(signals: PostSignals[], settings: SettingsV1): Promise<Map<string, PolicyOutcome>>;
}

export class DefaultPolicyEngine implements PolicyEngine {
  async evaluateOne(signals: PostSignals, settings: SettingsV1): Promise<PolicyOutcome> {
    const label = this.classifyDeterministic(signals, settings);
    const finalLabel = label ?? "REVIEW";
    return {
      classification: {
        label: finalLabel,
        confidence: finalLabel === "REVIEW" ? 0.3 : 0.9,
        reasonCodes: [label ? "RULE_MATCH" : "FALLBACK_REVIEW"]
      },
      action: this.toAction(finalLabel, settings)
    };
  }

  async evaluateBatch(signals: PostSignals[], settings: SettingsV1): Promise<Map<string, PolicyOutcome>> {
    const result = new Map<string, PolicyOutcome>();
    for (const item of signals) {
      result.set(item.unitId, await this.evaluateOne(item, settings));
    }
    return result;
  }

  private classifyDeterministic(signals: PostSignals, settings: SettingsV1): PostLabel | null {
    const sourceMatchedAllow = settings.rules.allowSources.some((source) =>
      this.sourceNameMatches(source.name, signals.sourceName)
    );
    if (settings.rules.priority.allowlistOverridesAll && sourceMatchedAllow) {
      return "ALLOW";
    }

    const sourceMatchedBlock = settings.rules.blockSources.some((source) =>
      this.sourceNameMatches(source.name, signals.sourceName)
    );
    if (sourceMatchedBlock) {
      return "HIDE";
    }

    if (settings.rules.hideSponsored && signals.isSponsored) {
      return "HIDE";
    }

    if (settings.rules.hideSuggested && signals.isSuggested) {
      return "HIDE";
    }

    if (settings.rules.collapseReels && signals.isReel) {
      return "COLLAPSE";
    }

    if (settings.rules.hideFollowMarked && signals.isFollowMarked) {
      return "HIDE";
    }

    const text = signals.text.toLowerCase();
    if (settings.rules.allowKeywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
      return "ALLOW";
    }

    if (settings.rules.blockKeywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
      return "HIDE";
    }

    return null;
  }

  private sourceNameMatches(ruleSourceName: string, actualSourceName: string | undefined): boolean {
    return normalizeSourceName(ruleSourceName) === normalizeSourceName(actualSourceName);
  }

  private toAction(label: PostLabel, settings: SettingsV1): ActionDecision {
    const fallbackAction = settings.ui.reviewFallbackAction;

    switch (label) {
      case "ALLOW":
        return { action: "KEEP", confidence: 0.9, reasonCodes: ["ALLOW"] };
      case "HIDE":
        return { action: "HIDE", confidence: 0.9, reasonCodes: ["HIDE"] };
      case "TLDR":
        return { action: "REPLACE_WITH_TLDR", confidence: 0.85, reasonCodes: ["TLDR"] };
      case "COLLAPSE":
        return { action: "COLLAPSE", confidence: 0.85, reasonCodes: ["COLLAPSE"] };
      case "REVIEW":
      default:
        return {
          action: fallbackAction === "KEEP" ? "KEEP" : "COLLAPSE",
          confidence: 0.3,
          reasonCodes: ["REVIEW_FALLBACK"]
        };
    }
  }
}
