#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";

import { planTask } from "../prompt-router.mjs";

const config = {
  routing: {
    trivialKeywords: ["rename", "copy", "comment", "small doc"],
    nonTrivialKeywords: ["ci", "api", "auth", "route", "multi-agent"],
    trivialStartsAt: "implement",
    nonTrivialStages: ["understand", "architect", "implement", "review-breadth"],
    intentProfiles: {
      assistant: { profile: "assistant", description: "Answer questions", keywords: ["find", "explain"] },
      coder: { profile: "coder", description: "Write code", keywords: ["fix bug", "refactor"] },
    },
    profiles: {
      assistant: { mode: "trivial", stages: ["implement"] },
      coder: { mode: "non-trivial", stages: ["implement", "review-breadth"] },
    },
  },
  models: { implementer: { model: "impl" }, reviewer: { model: "rev" } },
};

function route(task) {
  return planTask(task, config, {});
}

test("keyword does not match inside a longer word", () => {
  for (const [task, keyword] of [
    ["make a decision about caching", "ci"],
    ["improve efficiency of the parser", "ci"],
    ["rapid prototype of the grid", "api"],
    ["the author of this module", "auth"],
    ["update the router wiring", "route"],
  ]) {
    const result = route(task);
    assert.notEqual(
      result.rationale.stateFactors.find((f) => f.startsWith("non-trivial-keyword-hit:")),
      `non-trivial-keyword-hit:${keyword}`,
      `"${keyword}" must not match inside "${task}"`,
    );
  }
});

test("keyword still matches as a standalone word", () => {
  const result = route("update the ci pipeline");
  assert.ok(result.rationale.stateFactors.includes("non-trivial-keyword-hit:ci"));
});

test("trivial keyword does not match inside a longer word", () => {
  const result = route("update the copyright header");
  assert.ok(result.rationale.stateFactors.includes("trivial-keyword-hit:none"));
});

test("trivial keyword matches at a word boundary next to punctuation", () => {
  const result = route("fix a typo: rename, then stop");
  assert.ok(result.rationale.stateFactors.includes("trivial-keyword-hit:rename"));
});

test("multi-word and hyphenated keywords match as whole phrases", () => {
  assert.ok(route("add a small doc note").rationale.stateFactors.includes("trivial-keyword-hit:small doc"));
  assert.ok(route("design multi-agent handoff").rationale.stateFactors.includes("non-trivial-keyword-hit:multi-agent"));
  assert.ok(
    !route("design multi-agentic handoff").rationale.stateFactors.includes("non-trivial-keyword-hit:multi-agent"),
    "hyphenated keyword must not match a longer word",
  );
});

test("intent keywords no longer fire on substrings (mao-001 regression)", () => {
  const result = route("Have the reviewer pass its findings to a second worker");
  assert.notEqual(result.intent, "assistant", "'find' must not match inside 'findings'");
});

test("intent keywords still fire on whole words", () => {
  assert.equal(route("explain how the queue drains").intent, "assistant");
});

test("malformed keywords are ignored rather than throwing", () => {
  const hostile = structuredClone(config);
  hostile.routing.nonTrivialKeywords = ["", "   ", "a(b", "c*d"];
  assert.doesNotThrow(() => planTask("a(b c*d", hostile, {}));
});
