import { SettingsV1 } from "../shared/contracts";

const SETTINGS_KEY = "fbclean.settings";

const globalModeInput = document.getElementById("globalMode") as HTMLSelectElement;
const hideSponsoredInput = document.getElementById("hideSponsored") as HTMLInputElement;
const saveButton = document.getElementById("save") as HTMLButtonElement;

const load = async (): Promise<void> => {
  const payload = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = payload[SETTINGS_KEY] as SettingsV1 | undefined;
  if (!settings) {
    return;
  }

  globalModeInput.value = settings.globalMode;
  hideSponsoredInput.checked = settings.rules.hideSponsored;
};

saveButton.addEventListener("click", async () => {
  const payload = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = payload[SETTINGS_KEY] as SettingsV1;
  settings.globalMode = globalModeInput.value as SettingsV1["globalMode"];
  settings.rules.hideSponsored = hideSponsoredInput.checked;
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
});

void load();
