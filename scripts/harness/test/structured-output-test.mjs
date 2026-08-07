#!/usr/bin/env node
import assert from "node:assert/strict";

import {
  StructuredOutputError,
  extractStructuredJson,
  extractStructuredOutput,
  extractStructuredString,
  findLastTagContent,
  unwrapJsonFence,
} from "../structured-output.mjs";

function assertStructuredError(fn, code) {
  assert.throws(
    fn,
    (error) => error instanceof StructuredOutputError && error.code === code,
    `expected StructuredOutputError code=${code}`,
  );
}

assert.equal(findLastTagContent("before <result>one</result> after", "result"), "one");
assert.equal(
  findLastTagContent("<result>draft</result> noise <result>final</result>", "result"),
  "final",
  "last matching tag should win",
);
assert.equal(findLastTagContent("<result>unterminated", "result"), undefined);

assert.equal(unwrapJsonFence('```json\n{"ok":true}\n```'), '{"ok":true}');
assert.equal(unwrapJsonFence('```\n{"ok":true}\n```'), '{"ok":true}');
assert.equal(unwrapJsonFence('{"ok":true}'), '{"ok":true}');

assert.deepEqual(
  extractStructuredJson('model text <output>{"answer":42}</output>', { tag: "output" }),
  { answer: 42 },
);
assert.deepEqual(
  extractStructuredJson('<output>```json\n{"answer":42}\n```</output>', { tag: "output" }),
  { answer: 42 },
);
assert.equal(
  extractStructuredString("<summary>  ship it  </summary>", { tag: "summary" }),
  "ship it",
);
assert.deepEqual(
  extractStructuredOutput('<output>{"status":"ok"}</output>', {
    type: "object",
    tag: "output",
    validate(value) {
      assert.equal(value.status, "ok");
      return { normalized: value.status };
    },
  }),
  { normalized: "ok" },
);
assert.equal(
  extractStructuredOutput("<summary>done</summary>", { type: "string", tag: "summary" }),
  "done",
);

assertStructuredError(() => extractStructuredJson("no tag", { tag: "output" }), "TAG_NOT_FOUND");
assertStructuredError(
  () => extractStructuredJson("<output>{bad json}</output>", { tag: "output" }),
  "INVALID_JSON",
);
assertStructuredError(
  () =>
    extractStructuredJson("<output>{}</output>", {
      tag: "output",
      validate() {
        throw new Error("missing status");
      },
    }),
  "VALIDATION_FAILED",
);
assertStructuredError(
  () => extractStructuredOutput("<output>{}</output>", { type: "xml", tag: "output" }),
  "UNSUPPORTED_TYPE",
);

console.log("PASS structured output test suite");