#!/usr/bin/env node

export class StructuredOutputError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "StructuredOutputError";
    this.code = options.code || "STRUCTURED_OUTPUT_ERROR";
    this.tag = options.tag;
    this.rawMatched = options.rawMatched;
    this.cause = options.cause;
  }
}

function assertTag(tag) {
  if (typeof tag !== "string" || tag.trim().length === 0) {
    throw new StructuredOutputError("structured output tag must be a non-empty string", {
      code: "INVALID_TAG",
      tag,
    });
  }
  return tag.trim();
}

export function findLastTagContent(text, tag) {
  const safeTag = assertTag(tag);
  const source = String(text ?? "");
  const openTag = `<${safeTag}>`;
  const closeTag = `</${safeTag}>`;

  let lastContent;
  let searchFrom = 0;

  while (true) {
    const openIndex = source.indexOf(openTag, searchFrom);
    if (openIndex === -1) break;

    const contentStart = openIndex + openTag.length;
    const closeIndex = source.indexOf(closeTag, contentStart);
    if (closeIndex === -1) break;

    lastContent = source.slice(contentStart, closeIndex);
    searchFrom = closeIndex + closeTag.length;
  }

  return lastContent;
}

export function unwrapJsonFence(text) {
  const trimmed = String(text ?? "").trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n\s*```\s*$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function missingTagError(tag) {
  return new StructuredOutputError(`Structured output tag <${tag}> not found`, {
    code: "TAG_NOT_FOUND",
    tag,
    rawMatched: undefined,
  });
}

export function extractStructuredString(text, options = {}) {
  const tag = assertTag(options.tag);
  const raw = findLastTagContent(text, tag);
  if (raw === undefined) {
    throw missingTagError(tag);
  }
  return raw.trim();
}

function applyValidator(value, validate, tag, raw) {
  if (typeof validate !== "function") {
    return value;
  }

  try {
    const result = validate(value);
    if (result === undefined) {
      return value;
    }
    return result;
  } catch (cause) {
    throw new StructuredOutputError(`Structured output tag <${tag}> failed validation`, {
      code: "VALIDATION_FAILED",
      tag,
      rawMatched: raw,
      cause,
    });
  }
}

export function extractStructuredJson(text, options = {}) {
  const tag = assertTag(options.tag);
  const raw = findLastTagContent(text, tag);
  if (raw === undefined) {
    throw missingTagError(tag);
  }

  let parsed;
  try {
    parsed = JSON.parse(unwrapJsonFence(raw));
  } catch (cause) {
    throw new StructuredOutputError(`Structured output tag <${tag}> contains invalid JSON`, {
      code: "INVALID_JSON",
      tag,
      rawMatched: raw,
      cause,
    });
  }

  return applyValidator(parsed, options.validate, tag, raw);
}

export function extractStructuredOutput(text, definition = {}) {
  const type = definition.type || definition.mode || definition._tag || "json";
  if (type === "string") {
    return extractStructuredString(text, definition);
  }
  if (type === "json" || type === "object") {
    return extractStructuredJson(text, definition);
  }
  throw new StructuredOutputError(`Unsupported structured output type: ${type}`, {
    code: "UNSUPPORTED_TYPE",
    tag: definition.tag,
  });
}