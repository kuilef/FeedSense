import { BgResponse, PostLabel, SettingsV1 } from "../shared/contracts";

const SETTINGS_KEY = "fbclean.settings";

const SOURCE_TYPES = ["PERSON", "PAGE", "GROUP"] as const;
const POST_LABELS: readonly PostLabel[] = ["ALLOW", "HIDE", "TLDR", "COLLAPSE", "REVIEW"] as const;

const settingsForm = getById<HTMLFormElement>("settingsForm");
const schemaVersionInput = getById<HTMLInputElement>("schemaVersion");
const globalModeInput = getById<HTMLSelectElement>("globalMode");
const collapseStyleInput = getById<HTMLSelectElement>("collapseStyle");
const reviewFallbackActionInput = getById<HTMLSelectElement>("reviewFallbackAction");

const hideSponsoredInput = getById<HTMLInputElement>("hideSponsored");
const hideSuggestedInput = getById<HTMLInputElement>("hideSuggested");
const collapseReelsInput = getById<HTMLInputElement>("collapseReels");
const hideFollowMarkedInput = getById<HTMLInputElement>("hideFollowMarked");
const allowlistOverridesAllInput = getById<HTMLInputElement>("allowlistOverridesAll");
const blocklistOverridesLLMInput = getById<HTMLInputElement>("blocklistOverridesLLM");

const allowKeywordsInput = getById<HTMLTextAreaElement>("allowKeywords");
const blockKeywordsInput = getById<HTMLTextAreaElement>("blockKeywords");
const allowSourcesInput = getById<HTMLTextAreaElement>("allowSources");
const blockSourcesInput = getById<HTMLTextAreaElement>("blockSources");

const llmModeInput = getById<HTMLSelectElement>("llmMode");
const llmProviderInput = getById<HTMLSelectElement>("llmProvider");
const llmModelIdInput = getById<HTMLInputElement>("llmModelId");
const lazyTLDRInput = getById<HTMLSelectElement>("lazyTLDR");
const maxRequestsPerMinuteInput = getById<HTMLInputElement>("maxRequestsPerMinute");
const maxCharsToSendInput = getById<HTMLInputElement>("maxCharsToSend");
const minExtractionConfidenceInput = getById<HTMLInputElement>("minExtractionConfidence");
const minTextLenInput = getById<HTMLInputElement>("minTextLen");
const byokApiKeyEncryptedInput = getById<HTMLInputElement>("byokApiKeyEncrypted");
const paidLicenseTokenInput = getById<HTMLInputElement>("paidLicenseToken");
const paidEndpointBaseUrlInput = getById<HTMLInputElement>("paidEndpointBaseUrl");

const promptVersionInput = getById<HTMLInputElement>("promptVersion");
const decisionPolicyInput = getById<HTMLSelectElement>("decisionPolicy");
const outputStyleInput = getById<HTMLSelectElement>("outputStyle");
const maxBulletsInput = getById<HTMLInputElement>("maxBullets");
const maxCharsInput = getById<HTMLInputElement>("maxChars");
const promptIntentInput = getById<HTMLTextAreaElement>("promptIntent");
const promptLabelsInput = getById<HTMLTextAreaElement>("promptLabels");
const tldrForLabelsInput = getById<HTMLTextAreaElement>("tldrForLabels");

const debugEnabledInput = getById<HTMLInputElement>("debugEnabled");
const showReasonOnHoverInput = getById<HTMLInputElement>("showReasonOnHover");
const logToConsoleInput = getById<HTMLInputElement>("logToConsole");

const saveButton = getById<HTMLButtonElement>("save");
const reloadButton = getById<HTMLButtonElement>("reload");
const statusNode = getById<HTMLParagraphElement>("status");

function getById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: ${id}`);
  }
  return element as T;
}

const setStatus = (text: string, kind: "ok" | "error" | "info" = "info") => {
  statusNode.textContent = text;
  statusNode.className = kind === "info" ? "status" : `status ${kind}`;
};

const splitList = (raw: string): string[] =>
  raw
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);

const formatList = (items: string[]): string => items.join("\n");

const parseSourceType = (value: string): (typeof SOURCE_TYPES)[number] => {
  if (SOURCE_TYPES.includes(value as (typeof SOURCE_TYPES)[number])) {
    return value as (typeof SOURCE_TYPES)[number];
  }
  throw new Error(`Invalid source type: ${value}`);
};

const parseSourceList = (
  raw: string
): Array<{ type: "PERSON" | "PAGE" | "GROUP"; name: string; idHint?: string }> => {
  const lines = raw
    .split(/\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const [typeRaw = "", nameRaw = "", idHintRaw = ""] = line.split("|").map((part) => part.trim());
    const type = parseSourceType(typeRaw.toUpperCase());
    if (!nameRaw) {
      throw new Error(`Source name is required in line: ${line}`);
    }
    const value: { type: "PERSON" | "PAGE" | "GROUP"; name: string; idHint?: string } = {
      type,
      name: nameRaw
    };
    if (idHintRaw) {
      value.idHint = idHintRaw;
    }
    return value;
  });
};

const formatSourceList = (items: Array<{ type: "PERSON" | "PAGE" | "GROUP"; name: string; idHint?: string }>): string =>
  items
    .map((item) => (item.idHint ? `${item.type}|${item.name}|${item.idHint}` : `${item.type}|${item.name}`))
    .join("\n");

const parsePostLabel = (value: string): PostLabel => {
  const normalized = value.trim().toUpperCase() as PostLabel;
  if (POST_LABELS.includes(normalized)) {
    return normalized;
  }
  throw new Error(`Invalid post label: ${value}`);
};

const parsePromptLabels = (raw: string): Array<{ id: PostLabel; description: string }> => {
  const lines = raw
    .split(/\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const [idRaw = "", ...descParts] = line.split("|");
    const id = parsePostLabel(idRaw);
    const description = descParts.join("|").trim() || id;
    return { id, description };
  });
};

const formatPromptLabels = (labels: Array<{ id: PostLabel; description: string }>): string =>
  labels.map((label) => `${label.id}|${label.description}`).join("\n");

const parseInteger = (input: HTMLInputElement, field: string, min?: number, max?: number): number => {
  const value = Number.parseInt(input.value, 10);
  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be a number`);
  }
  if (min !== undefined && value < min) {
    throw new Error(`${field} must be >= ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`${field} must be <= ${max}`);
  }
  return value;
};

const parseNumberValue = (input: HTMLInputElement, field: string, min?: number, max?: number): number => {
  const value = Number.parseFloat(input.value);
  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be a number`);
  }
  if (min !== undefined && value < min) {
    throw new Error(`${field} must be >= ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`${field} must be <= ${max}`);
  }
  return value;
};

const parseSelect = <T extends string>(input: HTMLSelectElement, allowed: readonly T[], field: string): T => {
  const value = input.value as T;
  if (!allowed.includes(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
};

const loadSettings = async (): Promise<SettingsV1> => {
  try {
    const response = (await chrome.runtime.sendMessage({ type: "GET_SETTINGS" })) as BgResponse;
    if (response?.type === "SETTINGS") {
      return response.value;
    }
  } catch {
    // Fallback to direct storage read below.
  }

  const payload = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = payload[SETTINGS_KEY] as SettingsV1 | undefined;
  if (!settings) {
    throw new Error("Settings not found. Open any tab with the extension enabled, then reload options.");
  }

  return settings;
};

const applySettingsToForm = (settings: SettingsV1): void => {
  schemaVersionInput.value = String(settings.schemaVersion);
  globalModeInput.value = settings.globalMode;

  collapseStyleInput.value = settings.ui.collapseStyle;
  reviewFallbackActionInput.value = settings.ui.reviewFallbackAction;

  hideSponsoredInput.checked = settings.rules.hideSponsored;
  hideSuggestedInput.checked = settings.rules.hideSuggested;
  collapseReelsInput.checked = settings.rules.collapseReels;
  hideFollowMarkedInput.checked = settings.rules.hideFollowMarked;
  allowlistOverridesAllInput.checked = settings.rules.priority.allowlistOverridesAll;
  blocklistOverridesLLMInput.checked = settings.rules.priority.blocklistOverridesLLM;

  allowKeywordsInput.value = formatList(settings.rules.allowKeywords);
  blockKeywordsInput.value = formatList(settings.rules.blockKeywords);
  allowSourcesInput.value = formatSourceList(settings.rules.allowSources);
  blockSourcesInput.value = formatSourceList(settings.rules.blockSources);

  llmModeInput.value = settings.llm.mode;
  llmProviderInput.value = settings.llm.provider;
  llmModelIdInput.value = settings.llm.modelId;
  lazyTLDRInput.value = settings.llm.limits.lazyTLDR;
  maxRequestsPerMinuteInput.value = String(settings.llm.limits.maxRequestsPerMinute);
  maxCharsToSendInput.value = String(settings.llm.limits.maxCharsToSend);
  minExtractionConfidenceInput.value = String(settings.llm.limits.minExtractionConfidence);
  minTextLenInput.value = String(settings.llm.limits.minTextLen);

  byokApiKeyEncryptedInput.value = settings.llm.byok?.apiKeyEncrypted ?? "";
  paidLicenseTokenInput.value = settings.llm.paid?.licenseToken ?? "";
  paidEndpointBaseUrlInput.value = settings.llm.paid?.endpointBaseUrl ?? "";

  promptVersionInput.value = String(settings.llm.promptProfile.version);
  decisionPolicyInput.value = settings.llm.promptProfile.decisionPolicy;
  outputStyleInput.value = settings.llm.promptProfile.outputStyle;
  maxBulletsInput.value = String(settings.llm.promptProfile.maxBullets);
  maxCharsInput.value = String(settings.llm.promptProfile.maxChars);
  promptIntentInput.value = settings.llm.promptProfile.intent;
  promptLabelsInput.value = formatPromptLabels(settings.llm.promptProfile.labels);
  tldrForLabelsInput.value = formatList(settings.llm.promptProfile.tldrForLabels);

  debugEnabledInput.checked = settings.debug.enabled;
  showReasonOnHoverInput.checked = settings.debug.showReasonOnHover;
  logToConsoleInput.checked = settings.debug.logToConsole;
};

const collectSettingsFromForm = (): SettingsV1 => {
  const byokApiKeyEncrypted = byokApiKeyEncryptedInput.value.trim();
  const paidLicenseToken = paidLicenseTokenInput.value.trim();
  const paidEndpointBaseUrl = paidEndpointBaseUrlInput.value.trim();

  const parsedPromptLabels = parsePromptLabels(promptLabelsInput.value);
  if (!parsedPromptLabels.length) {
    throw new Error("Prompt labels must contain at least one row");
  }

  const settings: SettingsV1 = {
    schemaVersion: 1,
    globalMode: parseSelect(globalModeInput, ["ON", "OFF"], "globalMode"),
    ui: {
      collapseStyle: parseSelect(collapseStyleInput, ["COMPACT_CARD", "MINIMAL_BAR"], "ui.collapseStyle"),
      reviewFallbackAction: parseSelect(reviewFallbackActionInput, ["KEEP", "COLLAPSE"], "ui.reviewFallbackAction")
    },
    rules: {
      blockSources: parseSourceList(blockSourcesInput.value),
      allowSources: parseSourceList(allowSourcesInput.value),
      blockKeywords: splitList(blockKeywordsInput.value),
      allowKeywords: splitList(allowKeywordsInput.value),
      hideSponsored: hideSponsoredInput.checked,
      hideSuggested: hideSuggestedInput.checked,
      collapseReels: collapseReelsInput.checked,
      hideFollowMarked: hideFollowMarkedInput.checked,
      priority: {
        allowlistOverridesAll: allowlistOverridesAllInput.checked,
        blocklistOverridesLLM: blocklistOverridesLLMInput.checked
      }
    },
    llm: {
      mode: parseSelect(llmModeInput, ["OFF", "BYOK", "PAID"], "llm.mode"),
      provider: parseSelect(llmProviderInput, ["OPENAI", "OTHER"], "llm.provider"),
      modelId: llmModelIdInput.value.trim(),
      promptProfile: {
        version: parseInteger(promptVersionInput, "llm.promptProfile.version", 1),
        intent: promptIntentInput.value.trim(),
        labels: parsedPromptLabels,
        tldrForLabels: splitList(tldrForLabelsInput.value).map(parsePostLabel),
        decisionPolicy: parseSelect(
          decisionPolicyInput,
          ["CLASSIFY_ONLY", "CLASSIFY_AND_TLDR"],
          "llm.promptProfile.decisionPolicy"
        ),
        outputStyle: parseSelect(outputStyleInput, ["BULLETS", "ONE_LINER"], "llm.promptProfile.outputStyle"),
        maxBullets: parseInteger(maxBulletsInput, "llm.promptProfile.maxBullets", 1),
        maxChars: parseInteger(maxCharsInput, "llm.promptProfile.maxChars", 1)
      },
      byok: byokApiKeyEncrypted ? { apiKeyEncrypted: byokApiKeyEncrypted } : undefined,
      paid:
        paidLicenseToken || paidEndpointBaseUrl
          ? { licenseToken: paidLicenseToken || undefined, endpointBaseUrl: paidEndpointBaseUrl || undefined }
          : undefined,
      limits: {
        maxRequestsPerMinute: parseInteger(maxRequestsPerMinuteInput, "llm.limits.maxRequestsPerMinute", 1),
        maxCharsToSend: parseInteger(maxCharsToSendInput, "llm.limits.maxCharsToSend", 1),
        lazyTLDR: parseSelect(lazyTLDRInput, ["ON_CLICK", "FOR_TLDR_CLASS", "OFF"], "llm.limits.lazyTLDR"),
        minExtractionConfidence: parseNumberValue(
          minExtractionConfidenceInput,
          "llm.limits.minExtractionConfidence",
          0,
          1
        ),
        minTextLen: parseInteger(minTextLenInput, "llm.limits.minTextLen", 0)
      }
    },
    debug: {
      enabled: debugEnabledInput.checked,
      showReasonOnHover: showReasonOnHoverInput.checked,
      logToConsole: logToConsoleInput.checked
    }
  };

  if (!settings.llm.modelId) {
    throw new Error("llm.modelId cannot be empty");
  }

  if (!settings.llm.promptProfile.intent) {
    throw new Error("llm.promptProfile.intent cannot be empty");
  }

  return settings;
};

const reload = async () => {
  setStatus("Loading settings...", "info");
  const settings = await loadSettings();
  applySettingsToForm(settings);
  setStatus("Loaded", "ok");
};

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveButton.disabled = true;
  setStatus("Saving...", "info");

  try {
    const next = collectSettingsFromForm();
    await chrome.storage.local.set({ [SETTINGS_KEY]: next });
    setStatus(`Saved at ${new Date().toLocaleTimeString()}`, "ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Save failed: ${message}`, "error");
  } finally {
    saveButton.disabled = false;
  }
});

reloadButton.addEventListener("click", () => {
  void reload().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Load failed: ${message}`, "error");
  });
});

void reload().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(`Load failed: ${message}`, "error");
});
