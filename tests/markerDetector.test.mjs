import test from "node:test";
import assert from "node:assert/strict";

import { LocalizedMarkerDetector } from "../dist/content/markerDetector.js";

test("detects sponsored/suggested/reels/follow markers", () => {
  const detector = new LocalizedMarkerDetector();
  const fakeEl = {
    getAttribute: () => "Sponsored content"
  };

  const result = detector.detect(fakeEl, "Рекомендовано для вас and reels Follow");

  assert.equal(result.flags.isSponsored, true);
  assert.equal(result.flags.isSuggested, true);
  assert.equal(result.flags.isReel, true);
  assert.equal(result.flags.isFollowMarked, true);
  assert.ok(result.markers.includes("SPONSORED_TOKEN"));
  assert.ok(result.markers.includes("SUGGESTED_TOKEN"));
  assert.ok(result.markers.includes("REELS_TOKEN"));
  assert.ok(result.markers.includes("FOLLOW_TOKEN"));
});
