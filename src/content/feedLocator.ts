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

    const roleMain = doc.querySelector<HTMLElement>('[role="main"]');
    if (roleMain?.querySelector('[role="article"]')) {
      return roleMain;
    }

    const main = doc.querySelector<HTMLElement>("main");
    if (main?.querySelector('[role="article"]')) {
      return main;
    }

    const article = doc.querySelector<HTMLElement>('[role="article"]');
    const articlePagelet = article?.closest<HTMLElement>('[data-pagelet*="Feed" i], [data-pagelet*="MainFeed" i], [data-pagelet]');
    if (articlePagelet) {
      return articlePagelet;
    }

    if (article?.parentElement) {
      return article.parentElement;
    }

    const candidates = Array.from(doc.querySelectorAll<HTMLElement>("div"));
    return candidates.find((container) => container.querySelectorAll('[role="article"]').length >= 2) ?? null;
  }
}
