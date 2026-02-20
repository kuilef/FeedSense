import { SettingsV1 } from "../../shared/contracts";

export const DEFAULT_SETTINGS: SettingsV1 = {
  schemaVersion: 1,
  globalMode: "ON",
  ui: {
    collapseStyle: "COMPACT_CARD",
    reviewFallbackAction: "COLLAPSE"
  },
  rules: {
    blockSources: [],
    allowSources: [],
    blockKeywords: [],
    allowKeywords: [],
    hideSponsored: true,
    hideSuggested: false,
    collapseReels: true,
    priority: {
      allowlistOverridesAll: true,
      blocklistOverridesLLM: true
    }
  },
  llm: {
    mode: "OFF",
    provider: "OPENAI",
    modelId: "gpt-4.1-mini",
    promptProfile: {
      version: 1,
      intent: "Classify feed units for user relevance and safety.",
      labels: [
        { id: "ALLOW", description: "Keep post visible" },
        { id: "HIDE", description: "Hide the post" },
        { id: "TLDR", description: "Replace with concise summary" },
        { id: "COLLAPSE", description: "Collapse post" },
        { id: "REVIEW", description: "Uncertain classification" }
      ],
      tldrForLabels: ["TLDR"],
      decisionPolicy: "CLASSIFY_ONLY",
      outputStyle: "BULLETS",
      maxBullets: 3,
      maxChars: 280
    },
    limits: {
      maxRequestsPerMinute: 20,
      maxCharsToSend: 1500,
      lazyTLDR: "ON_CLICK",
      minExtractionConfidence: 0.4,
      minTextLen: 40
    }
  },
  debug: {
    enabled: false,
    showReasonOnHover: false,
    logToConsole: false
  }
};
