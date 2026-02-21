import { PostSignals } from "../shared/contracts";

const SPONSORED = ["sponsored", "реклама", "ממומן"];
const SUGGESTED = ["suggested for you", "рекомендовано", "מומלץ"];
const REELS = ["reels", "рилс", "רילס"];
const FOLLOW_MARKED = ["follow", "подписаться", "עקוב", "לעקוב"];

const normalize = (value: string): string => value.replace(/\s+/g, " ").trim().toLowerCase();

const hasFollowToken = (value: string): boolean => {
  const normalized = normalize(value);
  if (!normalized) {
    return false;
  }

  return FOLLOW_MARKED.some((token) => {
    return (
      normalized === token ||
      normalized.startsWith(`${token} `) ||
      normalized.endsWith(` ${token}`) ||
      normalized.includes(` ${token} `) ||
      normalized.includes(`· ${token}`) ||
      normalized.includes(`${token} ·`)
    );
  });
};

const collectInteractiveTexts = (unitEl: HTMLElement): string[] => {
  const values: string[] = [];
  const push = (value: string | null | undefined) => {
    if (!value) {
      return;
    }
    values.push(value);
  };

  push(unitEl.getAttribute("aria-label"));
  push(unitEl.getAttribute("title"));

  const elements = unitEl.querySelectorAll<HTMLElement>(
    'button, [role="button"], a[role="link"], [aria-label], [title], [data-tooltip-content]'
  );
  for (let i = 0; i < elements.length; i += 1) {
    const el = elements[i];
    push(el.textContent);
    push(el.getAttribute("aria-label"));
    push(el.getAttribute("title"));
    push(el.getAttribute("data-tooltip-content"));
  }

  return values;
};

export interface MarkerDetector {
  detect(unitEl: HTMLElement, textAggregate: string): { flags: Partial<PostSignals>; markers: string[] };
}

export class LocalizedMarkerDetector implements MarkerDetector {
  detect(unitEl: HTMLElement, textAggregate: string): { flags: Partial<PostSignals>; markers: string[] } {
    const lower = `${textAggregate} ${unitEl.getAttribute("aria-label") ?? ""}`.toLowerCase();
    const markers: string[] = [];
    const flags: Partial<PostSignals> = {};

    if (SPONSORED.some((token) => lower.includes(token))) {
      flags.isSponsored = true;
      markers.push("SPONSORED_TOKEN");
    }

    if (SUGGESTED.some((token) => lower.includes(token))) {
      flags.isSuggested = true;
      markers.push("SUGGESTED_TOKEN");
    }

    if (REELS.some((token) => lower.includes(token))) {
      flags.isReel = true;
      markers.push("REELS_TOKEN");
    }

    const rawText = (unitEl.textContent ?? "").slice(0, 12000);
    const followTexts = [textAggregate, rawText, ...collectInteractiveTexts(unitEl)];
    if (followTexts.some((value) => hasFollowToken(value))) {
      flags.isFollowMarked = true;
      markers.push("FOLLOW_TOKEN");
    }

    return { flags, markers };
  }
}
