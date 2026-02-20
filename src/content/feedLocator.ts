export interface FeedLocator {
  locateFeedRoot(doc: Document): HTMLElement | null;
}

export class FacebookFeedLocator implements FeedLocator {
  locateFeedRoot(doc: Document): HTMLElement | null {
    const roleFeed = doc.querySelector<HTMLElement>('[role="feed"]');
    if (roleFeed) {
      return roleFeed;
    }

    const pageletFeed = doc.querySelector<HTMLElement>('[data-pagelet*="Feed" i]');
    if (pageletFeed) {
      return pageletFeed;
    }

    const candidates = Array.from(doc.querySelectorAll<HTMLElement>("div"));
    return candidates.find((container) => container.querySelectorAll('[role="article"]').length >= 3) ?? null;
  }
}
