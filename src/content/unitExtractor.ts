import { PostSignals } from "../shared/contracts";
import { extractTextContent, getNewsFeedBlocksQuery } from "./cmfCore";
import { LocalizedMarkerDetector } from "./markerDetector";

export interface UnitExtractor {
  extract(unitEl: HTMLElement): PostSignals;
}

const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();

const SOURCE_LINK_SELECTORS = [
  'h2 a[role="link"]',
  'h3 a[role="link"]',
  'strong a[role="link"]',
  'a[role="link"][href*="/groups/"]',
  'a[role="link"]'
];

const ACTION_LINK_LABELS = new Set([
  "like",
  "comment",
  "share",
  "follow",
  "join",
  "see more",
  "view more",
  "learn more"
]);

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `${hash}`;
};

const buildTextAggregate = (unitEl: HTMLElement): { text: string; confidence: number } => {
  const extracted = extractTextContent(unitEl, getNewsFeedBlocksQuery(unitEl), 3);
  if (extracted.length > 0) {
    const text = normalize(extracted.join(" ")).slice(0, 3000);
    return { text, confidence: text.length > 60 ? 0.85 : 0.65 };
  }

  const fallbackText = normalize(unitEl.innerText || unitEl.textContent || "").slice(0, 3000);
  return { text: fallbackText, confidence: fallbackText.length > 40 ? 0.7 : 0.35 };
};

export class FacebookUnitExtractor implements UnitExtractor {
  private markerDetector = new LocalizedMarkerDetector();

  extract(unitEl: HTMLElement): PostSignals {
    const { text, confidence } = buildTextAggregate(unitEl);
    const markers = this.markerDetector.detect(unitEl, text);
    const canonicalHash = hashString(text);
    const source = this.extractSource(unitEl);

    return {
      unitId: crypto.randomUUID(),
      canonicalHash,
      url: window.location.href,
      text,
      extractionConfidence: confidence,
      markers: markers.markers,
      ...source,
      ...markers.flags
    };
  }

  private extractSource(
    unitEl: HTMLElement
  ): Pick<PostSignals, "sourceName" | "sourceType" | "sourceIdHint"> {
    const seen = new Set<HTMLAnchorElement>();

    for (const selector of SOURCE_LINK_SELECTORS) {
      const links = Array.from(unitEl.querySelectorAll<HTMLAnchorElement>(selector));
      for (const link of links) {
        if (seen.has(link)) {
          continue;
        }
        seen.add(link);

        const sourceName = normalize(link.textContent ?? "");
        if (!sourceName || sourceName.length > 140) {
          continue;
        }
        if (ACTION_LINK_LABELS.has(sourceName.toLowerCase())) {
          continue;
        }

        const href = this.resolveHref(link.getAttribute("href"));
        const sourceType = this.detectSourceType(href);
        const sourceIdHint = sourceType === "GROUP" ? this.extractGroupId(href) : undefined;
        return { sourceName, sourceType, sourceIdHint };
      }
    }

    return {};
  }

  private resolveHref(rawHref: string | null): string | undefined {
    if (!rawHref) {
      return undefined;
    }

    try {
      return new URL(rawHref, window.location.origin).href;
    } catch {
      return undefined;
    }
  }

  private detectSourceType(href: string | undefined): PostSignals["sourceType"] {
    if (!href) {
      return "UNKNOWN";
    }

    if (href.includes("/groups/")) {
      return "GROUP";
    }

    if (href.includes("/profile.php") || href.includes("/people/")) {
      return "PERSON";
    }

    return "PAGE";
  }

  private extractGroupId(href: string | undefined): string | undefined {
    if (!href) {
      return undefined;
    }

    const match = href.match(/\/groups\/([^/?#]+)/i);
    return match?.[1];
  }
}
