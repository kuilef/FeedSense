import { MessageRouter } from "./messageRouter";

const router = new MessageRouter();
router.register();

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("fbclean.cache.cleanup", { periodInMinutes: 60 * 24 });
});
