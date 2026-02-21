import { SettingsV1 } from "../../shared/contracts";
import { DEFAULT_SETTINGS } from "./defaultSettings";

const SETTINGS_KEY = "fbclean.settings";

export class SettingsStore {
  async get(): Promise<SettingsV1> {
    const payload = await chrome.storage.local.get(SETTINGS_KEY);
    const value = payload[SETTINGS_KEY] as SettingsV1 | undefined;
    if (!value) {
      await this.set(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }

    return this.migrate(value);
  }

  async set(settings: SettingsV1): Promise<void> {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }

  private migrate(settings: SettingsV1): SettingsV1 {
    if (settings.schemaVersion !== 1) {
      return DEFAULT_SETTINGS;
    }

    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      ui: {
        ...DEFAULT_SETTINGS.ui,
        ...settings.ui
      },
      rules: {
        ...DEFAULT_SETTINGS.rules,
        ...settings.rules,
        priority: {
          ...DEFAULT_SETTINGS.rules.priority,
          ...settings.rules?.priority
        }
      },
      llm: {
        ...DEFAULT_SETTINGS.llm,
        ...settings.llm,
        promptProfile: {
          ...DEFAULT_SETTINGS.llm.promptProfile,
          ...settings.llm?.promptProfile
        },
        limits: {
          ...DEFAULT_SETTINGS.llm.limits,
          ...settings.llm?.limits
        }
      },
      debug: {
        ...DEFAULT_SETTINGS.debug,
        ...settings.debug
      }
    };
  }
}
