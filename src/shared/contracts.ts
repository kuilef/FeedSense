export type PostLabel = "ALLOW" | "HIDE" | "TLDR" | "COLLAPSE" | "REVIEW";
export type ActionKind = "KEEP" | "HIDE" | "COLLAPSE" | "REPLACE_WITH_TLDR";

export interface TLDRResult {
  title?: string;
  bullets: string[];
  oneLiner?: string;
  lang?: string;
}

export interface ClassificationResult {
  label: PostLabel;
  confidence: number;
  reasonCodes: string[];
  summary?: TLDRResult;
  tags?: string[];
}

export interface ActionDecision {
  action: ActionKind;
  confidence: number;
  reasonCodes: string[];
  tldr?: TLDRResult;
}

export interface PolicyOutcome {
  classification: ClassificationResult;
  action: ActionDecision;
}

export interface PostSignals {
  unitId: string;
  canonicalHash: string;
  url?: string;

  authorName?: string;
  authorIdHint?: string;
  sourceType?: "PERSON" | "PAGE" | "GROUP" | "UNKNOWN";
  sourceName?: string;
  sourceIdHint?: string;

  text: string;
  languageHint?: string;

  hasMedia?: boolean;
  mediaType?: "IMAGE" | "VIDEO" | "LINK" | "MIXED" | "UNKNOWN";

  isSponsored?: boolean;
  isSuggested?: boolean;
  isReel?: boolean;

  extractionConfidence: number;
  markers: string[];
}

export interface SettingsV1 {
  schemaVersion: 1;
  globalMode: "OFF" | "ON";
  ui: {
    collapseStyle: "COMPACT_CARD" | "MINIMAL_BAR";
    reviewFallbackAction: "KEEP" | "COLLAPSE";
  };
  rules: {
    blockSources: Array<{ type: "PERSON" | "PAGE" | "GROUP"; name: string; idHint?: string }>;
    allowSources: Array<{ type: "PERSON" | "PAGE" | "GROUP"; name: string; idHint?: string }>;
    blockKeywords: string[];
    allowKeywords: string[];
    hideSponsored: boolean;
    hideSuggested: boolean;
    collapseReels: boolean;
    priority: {
      allowlistOverridesAll: boolean;
      blocklistOverridesLLM: boolean;
    };
  };
  llm: {
    mode: "OFF" | "BYOK" | "PAID";
    provider: "OPENAI" | "OTHER";
    modelId: string;
    promptProfile: {
      version: number;
      intent: string;
      labels: Array<{ id: PostLabel; description: string }>;
      tldrForLabels: PostLabel[];
      decisionPolicy: "CLASSIFY_ONLY" | "CLASSIFY_AND_TLDR";
      outputStyle: "BULLETS" | "ONE_LINER";
      maxBullets: number;
      maxChars: number;
    };
    byok?: { apiKeyEncrypted?: string };
    paid?: { licenseToken?: string; endpointBaseUrl?: string };
    limits: {
      maxRequestsPerMinute: number;
      maxCharsToSend: number;
      lazyTLDR: "ON_CLICK" | "FOR_TLDR_CLASS" | "OFF";
      minExtractionConfidence: number;
      minTextLen: number;
    };
  };
  debug: {
    enabled: boolean;
    showReasonOnHover: boolean;
    logToConsole: boolean;
  };
}

export type BgRequest =
  | { type: "GET_SETTINGS" }
  | { type: "EVALUATE_BATCH"; items: PostSignals[]; settingsVersion: number }
  | { type: "USER_OVERRIDE"; canonicalHash: string; action: "ALLOW" | "BLOCK"; meta?: Record<string, unknown> }
  | { type: "REQUEST_TLDR"; canonicalHash: string; signals: PostSignals; settingsVersion: number };

export type BgResponse =
  | { type: "SETTINGS"; value: SettingsV1 }
  | { type: "EVALUATE_BATCH_RESULT"; results: Array<{ unitId: string; outcome: PolicyOutcome }> }
  | { type: "TLDR_RESULT"; canonicalHash: string; tldr: TLDRResult | null; reasonCodes: string[] };
