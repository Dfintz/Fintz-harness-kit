#!/usr/bin/env node

export class ReviewOutputError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ReviewOutputError";
    this.code = options.code || "REVIEW_OUTPUT_ERROR";
    this.value = options.value;
  }
}

function asRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReviewOutputError(`${label} must be an object`, {
      code: "INVALID_REVIEW_OUTPUT",
      value,
    });
  }
  return value;
}

function asString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ReviewOutputError(`${label} must be a non-empty string`, {
      code: "INVALID_REVIEW_OUTPUT",
      value,
    });
  }
  return value.trim();
}

function asArray(value, label) {
  if (!Array.isArray(value)) {
    throw new ReviewOutputError(`${label} must be an array`, {
      code: "INVALID_REVIEW_OUTPUT",
      value,
    });
  }
  return value;
}

function parseLine(value, record) {
  if (Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof record.lineRange === "string") {
    const firstLine = record.lineRange.match(/\d+/)?.[0];
    if (firstLine) return Number(firstLine);
  }
  throw new ReviewOutputError(
    "inline comment line must be a positive integer or lineRange must start with a line number",
    { code: "INVALID_INLINE_COMMENT", value: record },
  );
}

export function parseInlineComment(value) {
  const record = asRecord(value, "inline comment");
  return {
    path: asString(record.path ?? record.file, "inline comment path"),
    line: parseLine(record.line, record),
    body: asString(record.body ?? record.comment, "inline comment body"),
  };
}

export function parseThreadReply(value) {
  const record = asRecord(value, "thread reply");
  return {
    commentId: asString(record.commentId, "thread reply commentId"),
    body: asString(record.body ?? record.comment, "thread reply body"),
  };
}

export function parseReviewOutput(value) {
  const record = asRecord(value, "review output");
  return {
    summary: asString(record.summary, "review summary"),
    inlineComments: asArray(record.inlineComments ?? [], "inlineComments").map(parseInlineComment),
    replies: asArray(record.replies ?? [], "replies").map(parseThreadReply),
  };
}

export function parseDiffLines(diffText) {
  const files = new Map();
  let currentFile;
  let newLine = 0;

  for (const line of String(diffText ?? "").split("\n")) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice("+++ b/".length);
      if (!files.has(currentFile)) files.set(currentFile, new Set());
      continue;
    }

    if (!currentFile) continue;

    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      files.get(currentFile)?.add(newLine);
      newLine += 1;
      continue;
    }

    if (line.startsWith(" ") || line === "") {
      files.get(currentFile)?.add(newLine);
      newLine += 1;
    }
  }

  return files;
}

export function filterInlineComments(comments, diffLines) {
  const accepted = [];
  const rejected = [];

  for (const comment of comments) {
    const fileLines = diffLines.get(comment.path);
    if (!fileLines) {
      rejected.push({ item: comment, reason: "file-not-in-diff" });
      continue;
    }
    if (!fileLines.has(comment.line)) {
      rejected.push({ item: comment, reason: "line-not-in-diff-hunk" });
      continue;
    }
    accepted.push(comment);
  }

  return { accepted, rejected };
}

export function filterReplies(replies, validReplyIds) {
  const accepted = [];
  const rejected = [];

  for (const reply of replies) {
    if (!validReplyIds.has(reply.commentId)) {
      rejected.push({ item: reply, reason: "unknown-comment-id" });
      continue;
    }
    accepted.push(reply);
  }

  return { accepted, rejected };
}

export function validateReviewOutput(value, options = {}) {
  const output = parseReviewOutput(value);
  const diffLines =
    options.diffLines instanceof Map ? options.diffLines : parseDiffLines(options.diff ?? "");
  const validReplyIds =
    options.validReplyIds instanceof Set ? options.validReplyIds : new Set(options.validReplyIds ?? []);
  const inlineComments = filterInlineComments(output.inlineComments, diffLines);
  const replies = filterReplies(output.replies, validReplyIds);

  return {
    summary: output.summary,
    inlineComments: inlineComments.accepted,
    replies: replies.accepted,
    rejected: {
      inlineComments: inlineComments.rejected,
      replies: replies.rejected,
    },
  };
}