export interface UnitLocator {
  locateUnits(feedRoot: HTMLElement): HTMLElement[];
}

export class FacebookUnitLocator implements UnitLocator {
  locateUnits(feedRoot: HTMLElement): HTMLElement[] {
    const articles = Array.from(feedRoot.querySelectorAll<HTMLElement>('[role="article"]'));
    if (articles.length) {
      return articles;
    }

    const pagelets = Array.from(feedRoot.querySelectorAll<HTMLElement>('div[data-pagelet*="FeedUnit" i]'));
    if (pagelets.length) {
      return pagelets;
    }

    return Array.from(feedRoot.querySelectorAll<HTMLElement>("div")).filter((el) => {
      const controls = el.innerText.toLowerCase();
      return controls.includes("like") && controls.includes("comment") && controls.includes("share");
    });
  }
}
