import test from "node:test";
import assert from "node:assert/strict";

import { LocalizedMarkerDetector } from "../dist/content/markerDetector.js";

const createFakeEl = ({ ariaLabel = null, title = null, textContent = "", interactive = [] } = {}) => ({
  textContent,
  getAttribute: (name) => {
    if (name === "aria-label") {
      return ariaLabel;
    }
    if (name === "title") {
      return title;
    }
    return null;
  },
  querySelector: () => null,
  querySelectorAll: (selector) => {
    if (typeof selector === "string" && selector.includes("button")) {
      return interactive;
    }
    return [];
  }
});

test("detects sponsored/suggested/reels/follow markers", () => {
  const detector = new LocalizedMarkerDetector();
  const fakeEl = createFakeEl({ ariaLabel: "Sponsored content" });

  const result = detector.detect(fakeEl, "Рекомендовано для вас and reels Follow");

  assert.equal(result.flags.isSponsored, true);
  assert.equal(result.flags.isSuggested, true);
  assert.equal(result.flags.isReel, true);
  assert.equal(result.flags.isFollowMarked, true);
  assert.ok(result.markers.includes("SPONSORED_TOKEN"));
  assert.ok(result.markers.includes("SUGGESTED_TOKEN"));
  assert.ok(result.markers.includes("REELS_TOKEN"));
});

test("detects follow marker from interactive aria-label", () => {
  const detector = new LocalizedMarkerDetector();
  const fakeEl = createFakeEl({
    interactive: [
      {
        textContent: "",
        getAttribute: (name) => (name === "aria-label" ? "Follow" : null)
      }
    ]
  });

  const result = detector.detect(fakeEl, "Regular post text");

  assert.equal(result.flags.isFollowMarked, true);
});

test("does not treat following as follow marker", () => {
  const detector = new LocalizedMarkerDetector();
  const fakeEl = createFakeEl();

  const result = detector.detect(fakeEl, "Following updates from this page");

  assert.equal(result.flags.isFollowMarked, undefined);
});

test("detects follow token wrapped in punctuation", () => {
  const detector = new LocalizedMarkerDetector();
  const fakeEl = createFakeEl();

  const result = detector.detect(fakeEl, "People you may know (Follow)");

  assert.equal(result.flags.isFollowMarked, true);
});
