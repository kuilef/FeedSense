declare global {
  interface Window {
    __FB_CLEAN_DEBUG_BUILD__?: boolean;
  }
}

window.__FB_CLEAN_DEBUG_BUILD__ = true;
console.info("[FeedSense Debug] bootstrap injected", location.href);

export {};
