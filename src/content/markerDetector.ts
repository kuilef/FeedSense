import { PostSignals } from "../shared/contracts";
import {
  CMF_FOLLOW_DICTIONARY,
  CMF_REELS_AND_SHORT_VIDEOS_DICTIONARY,
  CMF_SPONSORED_DICTIONARY,
  CMF_SUGGESTIONS_DICTIONARY,
  isFollowPost,
  isPeopleYouMayKnowPost,
  isParticipatePost,
  isReelsAndShortVideosPost,
  isShortReelVideoPost,
  isSponsoredPaidByPost,
  isSponsoredPost,
  isSuggestedPost
} from "./cmfCore";
import { hasAnyToken } from "./tokenMatcher";

const LEGACY_SUGGESTED = ["suggested for you", "рекомендовано", "מומלץ"];
const LEGACY_REELS = ["reels", "reel", "рилс", "רילס"];

const collectInteractiveTexts = (unitEl: HTMLElement): string[] => {
  const values: string[] = [];
  const push = (value: string | null | undefined) => {
    if (!value) {
      return;
    }
    values.push(value);
  };

  push(unitEl.getAttribute("aria-label"));
  push(unitEl.getAttribute("aria-description"));
  push(unitEl.getAttribute("title"));

  const elements = unitEl.querySelectorAll<HTMLElement>(
    'button, [role="button"], a[role="link"], a[href], [aria-label], [aria-description], [title], [data-tooltip-content]'
  );
  for (let i = 0; i < elements.length; i += 1) {
    const el = elements[i];
    push(el.textContent);
    push(el.getAttribute("aria-label"));
    push(el.getAttribute("aria-description"));
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
    const markers: string[] = [];
    const flags: Partial<PostSignals> = {};

    const aggregate = `${textAggregate} ${unitEl.getAttribute("aria-label") ?? ""}`;
    const interactiveTexts = collectInteractiveTexts(unitEl);

    const sponsoredDetected =
      isSponsoredPost(unitEl) || isSponsoredPaidByPost(unitEl) || hasAnyToken(aggregate, CMF_SPONSORED_DICTIONARY);
    if (sponsoredDetected) {
      flags.isSponsored = true;
      markers.push("SPONSORED_TOKEN");
    }

    const suggestedDetected =
      isSuggestedPost(unitEl) ||
      isPeopleYouMayKnowPost(unitEl) ||
      hasAnyToken(aggregate, CMF_SUGGESTIONS_DICTIONARY) ||
      hasAnyToken(aggregate, LEGACY_SUGGESTED);
    if (suggestedDetected) {
      flags.isSuggested = true;
      markers.push("SUGGESTED_TOKEN");
    }

    const reelsDetected =
      isReelsAndShortVideosPost(unitEl) ||
      isShortReelVideoPost(unitEl) ||
      hasAnyToken(aggregate, CMF_REELS_AND_SHORT_VIDEOS_DICTIONARY) ||
      hasAnyToken(aggregate, LEGACY_REELS);
    if (reelsDetected) {
      flags.isReel = true;
      markers.push("REELS_TOKEN");
    }

    const followByStructure = isFollowPost(unitEl) || isParticipatePost(unitEl);
    const followByText = [aggregate, ...interactiveTexts].some((value) => hasAnyToken(value, CMF_FOLLOW_DICTIONARY));
    if (followByStructure || followByText) {
      flags.isFollowMarked = true;
      markers.push(followByStructure ? "FOLLOW_STRUCTURE" : "FOLLOW_TOKEN");
    }

    return { flags, markers };
  }
}
