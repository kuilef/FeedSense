import test from "node:test";
import assert from "node:assert/strict";

import { LocalizedMarkerDetector } from "../dist/content/markerDetector.js";

test("detects sponsored/suggested/reels/follow markers", () => {
  const detector = new LocalizedMarkerDetector();
  const fakeEl = {
    getAttribute: () => "Sponsored content",
    querySelectorAll: () => []
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

test("detects follow marker from interactive aria-label", () => {
  const detector = new LocalizedMarkerDetector();
  const fakeEl = {
    getAttribute: () => null,
    querySelectorAll: () => [
      {
        textContent: "",
        getAttribute: (name) => (name === "aria-label" ? "Follow" : null)
      }
    ]
  };

  const result = detector.detect(fakeEl, "Regular post text");

  assert.equal(result.flags.isFollowMarked, true);
  assert.ok(result.markers.includes("FOLLOW_TOKEN"));
});

test("does not treat following as follow marker", () => {
  const detector = new LocalizedMarkerDetector();
  const fakeEl = {
    getAttribute: () => null,
    querySelectorAll: () => []
  };

  const result = detector.detect(fakeEl, "Following updates from this page");

  assert.equal(result.flags.isFollowMarked, undefined);
  assert.equal(result.markers.includes("FOLLOW_TOKEN"), false);
});
