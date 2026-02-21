import { PostSignals } from "../shared/contracts";

const SPONSORED = ["sponsored", "реклама", "ממומן"];
const SUGGESTED = ["suggested for you", "рекомендовано", "מומלץ"];
const REELS = ["reels", "рилс", "רילס"];
const FOLLOW_MARKED = ["follow", "подписаться", "подписка", "עקוב", "לעקוב"];

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

    if (FOLLOW_MARKED.some((token) => lower.includes(token))) {
      flags.isFollowMarked = true;
      markers.push("FOLLOW_TOKEN");
    }

    return { flags, markers };
  }
}
