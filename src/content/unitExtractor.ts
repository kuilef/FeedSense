import { PostSignals } from "../shared/contracts";
import { LocalizedMarkerDetector } from "./markerDetector";

export interface UnitExtractor {
  extract(unitEl: HTMLElement): PostSignals;
}

const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `${hash}`;
};

export class FacebookUnitExtractor implements UnitExtractor {
  private markerDetector = new LocalizedMarkerDetector();

  extract(unitEl: HTMLElement): PostSignals {
    const text = normalize(unitEl.innerText).slice(0, 3000);
    const markers = this.markerDetector.detect(unitEl, text);
    const canonicalHash = hashString(text);

    return {
      unitId: crypto.randomUUID(),
      canonicalHash,
      text,
      extractionConfidence: text.length > 40 ? 0.7 : 0.35,
      markers: markers.markers,
      ...markers.flags
    };
  }
}
