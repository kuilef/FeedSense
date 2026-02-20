import { ClassificationResult, PostSignals, SettingsV1 } from "../../shared/contracts";

export class LLMClient {
  async classify(signals: PostSignals, settings: SettingsV1): Promise<ClassificationResult> {
    const mode = settings.llm.mode;
    if (mode === "OFF") {
      return {
        label: "REVIEW",
        confidence: 0.2,
        reasonCodes: ["LLM_DISABLED"]
      };
    }

    return {
      label: "REVIEW",
      confidence: 0.2,
      reasonCodes: ["LLM_NOT_IMPLEMENTED", `MODE_${mode}`]
    };
  }
}
