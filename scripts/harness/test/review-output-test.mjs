#!/usr/bin/env node
import assert from "node:assert/strict";

import {
  ReviewOutputError,
  filterInlineComments,
  filterReplies,
  parseDiffLines,
  parseInlineComment,
  parseReviewOutput,
  validateReviewOutput,
} from "../review-output.mjs";

function assertReviewOutputError(fn, code) {
  assert.throws(
    fn,
    (error) => error instanceof ReviewOutputError && error.code === code,
    `expected ReviewOutputError code=${code}`,
  );
}

const diff = [
  "diff --git a/src/example.js b/src/example.js",
  "index 0000000..1111111 100644",
  "--- a/src/example.js",
  "+++ b/src/example.js",
  "@@ -1,3 +1,4 @@",
  " const a = 1;",
  "+const b = 2;",
  " const c = 3;",
  "-const old = 4;",
  "@@ -10,2 +11,2 @@",
  " const z = 9;",
  "+const y = 8;",
].join("\n");

const diffLines = parseDiffLines(diff);
assert.deepEqual([...diffLines.get("src/example.js")].sort((a, b) => a - b), [1, 2, 3, 11, 12]);

assert.deepEqual(parseInlineComment({ file: "src/example.js", lineRange: "12-13", comment: "ok" }), {
  path: "src/example.js",
  line: 12,
  body: "ok",
});

const parsed = parseReviewOutput({
  summary: "Review summary",
  inlineComments: [
    { path: "src/example.js", line: 2, body: "changed line" },
    { path: "src/other.js", line: 1, body: "wrong file" },
  ],
  replies: [
    { commentId: "known", body: "reply" },
    { commentId: "unknown", body: "skip" },
  ],
});
assert.equal(parsed.inlineComments.length, 2);
assert.equal(parsed.replies.length, 2);

const comments = filterInlineComments(parsed.inlineComments, diffLines);
assert.deepEqual(comments.accepted, [{ path: "src/example.js", line: 2, body: "changed line" }]);
assert.equal(comments.rejected.length, 1);
assert.equal(comments.rejected[0].reason, "file-not-in-diff");

const replies = filterReplies(parsed.replies, new Set(["known"]));
assert.deepEqual(replies.accepted, [{ commentId: "known", body: "reply" }]);
assert.equal(replies.rejected.length, 1);
assert.equal(replies.rejected[0].reason, "unknown-comment-id");

const validated = validateReviewOutput(
  {
    summary: "Validated",
    inlineComments: [
      { path: "src/example.js", line: 2, body: "accept" },
      { path: "src/example.js", line: 8, body: "reject" },
    ],
    replies: [
      { commentId: "known", body: "accept" },
      { commentId: "missing", body: "reject" },
    ],
  },
  { diff, validReplyIds: ["known"] },
);
assert.equal(validated.inlineComments.length, 1);
assert.equal(validated.replies.length, 1);
assert.equal(validated.rejected.inlineComments[0].reason, "line-not-in-diff-hunk");
assert.equal(validated.rejected.replies[0].reason, "unknown-comment-id");

assertReviewOutputError(() => parseReviewOutput(null), "INVALID_REVIEW_OUTPUT");
assertReviewOutputError(
  () => parseReviewOutput({ summary: "ok", inlineComments: [{ path: "", line: 1, body: "x" }] }),
  "INVALID_REVIEW_OUTPUT",
);
assertReviewOutputError(
  () => parseReviewOutput({ summary: "ok", inlineComments: [{ path: "x", line: 0, body: "x" }] }),
  "INVALID_INLINE_COMMENT",
);

console.log("PASS review output test suite");