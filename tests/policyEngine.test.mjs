import test from "node:test";
import assert from "node:assert/strict";

import { DefaultPolicyEngine } from "../dist/background/policy/policyEngine.js";
import { DEFAULT_SETTINGS } from "../dist/background/settings/defaultSettings.js";

const baseSignals = {
  unitId: "u1",
  canonicalHash: "h1",
  url: "https://www.facebook.com/",
  text: "Regular post",
  extractionConfidence: 0.9,
  markers: []
};

test("hides sponsored posts when setting is enabled", async () => {
  const engine = new DefaultPolicyEngine();
  const outcome = await engine.evaluateOne({ ...baseSignals, isSponsored: true }, DEFAULT_SETTINGS);

  assert.equal(outcome.classification.label, "HIDE");
  assert.equal(outcome.action.action, "HIDE");
});

test("allowlist has priority over blocklist", async () => {
  const engine = new DefaultPolicyEngine();
  const settings = {
    ...DEFAULT_SETTINGS,
    rules: {
      ...DEFAULT_SETTINGS.rules,
      allowSources: [{ type: "PAGE", name: "Allowed" }],
      blockSources: [{ type: "PAGE", name: "Allowed" }]
    }
  };

  const outcome = await engine.evaluateOne({ ...baseSignals, sourceName: "Allowed" }, settings);
  assert.equal(outcome.classification.label, "ALLOW");
  assert.equal(outcome.action.action, "KEEP");
});

test("falls back to review action when there is no match", async () => {
  const engine = new DefaultPolicyEngine();
  const outcome = await engine.evaluateOne(baseSignals, DEFAULT_SETTINGS);

  assert.equal(outcome.classification.label, "REVIEW");
  assert.equal(outcome.action.action, "COLLAPSE");
});

test("hides follow-marked posts by default", async () => {
  const engine = new DefaultPolicyEngine();
  const outcome = await engine.evaluateOne({ ...baseSignals, isFollowMarked: true }, DEFAULT_SETTINGS);

  assert.equal(outcome.classification.label, "HIDE");
  assert.equal(outcome.action.action, "HIDE");
});

test("does not hide follow-marked posts when follow filter is disabled", async () => {
  const engine = new DefaultPolicyEngine();
  const settings = {
    ...DEFAULT_SETTINGS,
    rules: {
      ...DEFAULT_SETTINGS.rules,
      hideFollowMarked: false
    }
  };

  const outcome = await engine.evaluateOne({ ...baseSignals, isFollowMarked: true }, settings);
  assert.equal(outcome.classification.label, "REVIEW");
  assert.equal(outcome.action.action, "COLLAPSE");
});
