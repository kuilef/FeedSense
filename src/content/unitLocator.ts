import { collectNewsFeedPosts } from "./cmfCore";

export interface UnitLocator {
  locateUnits(feedRoot: HTMLElement): HTMLElement[];
}

const dedupeUnits = (units: HTMLElement[]): HTMLElement[] => {
  const seen = new Set<HTMLElement>();
  const result: HTMLElement[] = [];
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    if (seen.has(unit)) {
      continue;
    }
    seen.add(unit);
    result.push(unit);
  }
  return result;
};

const textLength = (element: HTMLElement): number => {
  return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().length;
};

const hasInteractiveContent = (element: HTMLElement): boolean => {
  return Boolean(element.querySelector('a[href], a[role="link"], [role="button"], button'));
};

const isLikelyFeedUnit = (element: HTMLElement): boolean => {
  if (!element.isConnected) {
    return false;
  }
  if (element.closest('[aria-hidden="true"]')) {
    return false;
  }

  const nestedArticles = element.querySelectorAll('[role="article"]').length;
  if (nestedArticles > 1) {
    return false;
  }

  const len = textLength(element);
  if (len < 30) {
    return false;
  }

  return hasInteractiveContent(element) || len > 120;
};

const normalizeUnit = (element: HTMLElement): HTMLElement => {
  const closestArticle = element.closest<HTMLElement>('[role="article"]');
  if (closestArticle) {
    return closestArticle;
  }

  const firstArticle = element.querySelector<HTMLElement>(':scope [role="article"]');
  return firstArticle ?? element;
};

const selectBestSet = (sets: HTMLElement[][]): HTMLElement[] => {
  let best: HTMLElement[] = [];
  for (let index = 0; index < sets.length; index += 1) {
    const normalized = dedupeUnits(sets[index].map(normalizeUnit));
    const filtered = normalized.filter(isLikelyFeedUnit);
    const candidate = filtered.length > 0 ? filtered : normalized;
    if (candidate.length > best.length) {
      best = candidate;
    }
  }
  return dedupeUnits(best);
};

export class FacebookUnitLocator implements UnitLocator {
  locateUnits(feedRoot: HTMLElement): HTMLElement[] {
    const doc = feedRoot.ownerDocument ?? document;

    const best = selectBestSet([
      collectNewsFeedPosts(feedRoot),
      collectNewsFeedPosts(doc),
      Array.from(feedRoot.querySelectorAll<HTMLElement>('[role="article"]')),
      Array.from(doc.querySelectorAll<HTMLElement>('[role="main"] [role="article"]')),
      Array.from(doc.querySelectorAll<HTMLElement>('div[role="feed"] > div')),
      Array.from(doc.querySelectorAll<HTMLElement>('div[role="feed"] > div > div')),
      Array.from(doc.querySelectorAll<HTMLElement>('div[data-pagelet*="FeedUnit" i]')),
      Array.from(feedRoot.querySelectorAll<HTMLElement>('div[data-pagelet*="FeedUnit" i]'))
    ]);

    if (best.length > 0) {
      return best;
    }

    return dedupeUnits(Array.from(feedRoot.querySelectorAll<HTMLElement>("div")).filter((el) => {
      const controls = el.innerText.toLowerCase();
      return controls.includes("like") && controls.includes("comment") && controls.includes("share");
    }));
  }
}
