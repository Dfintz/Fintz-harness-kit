import { createHash, randomUUID } from "node:crypto";

export const OUTPUT_CAPTURE_BYTES = 128 * 1024;
export const OUTPUT_WRAPPER_BYTES = 2 * 1024 * 1024;

export function markUntrustedResult(result) {
  return {
    ...result,
    _meta: {
      ...result._meta,
      provenance: {
        ...result._meta?.provenance,
        untrusted_content: true,
        source: "harness-tool-result",
      },
    },
  };
}

export function readOutputPolicy(config) {
  const policy = config?.commandDispatch?.retainedOutput;
  if (policy?.enabled !== true) return null;
  const responseBytes = policy.responseBytes ?? 32768;
  if (
    !Number.isSafeInteger(responseBytes) ||
    responseBytes < 8192 ||
    responseBytes > 65536
  )
    return null;
  return { responseBytes };
}

function safePrefix(text, limit) {
  let end = Math.min(text.length, limit);
  if (
    end > 0 &&
    end < text.length &&
    /[\uD800-\uDBFF]/.test(text[end - 1]) &&
    /[\uDC00-\uDFFF]/.test(text[end])
  )
    end -= 1;
  return text.slice(0, end);
}

function capturePrefix(text) {
  const bytes = Buffer.from(text || "", "utf8");
  if (bytes.length <= OUTPUT_CAPTURE_BYTES) return text || "";
  return bytes
    .subarray(0, OUTPUT_CAPTURE_BYTES)
    .toString("utf8")
    .replace(/\uFFFD$/, "");
}

export function captureProcessOutput(result) {
  const complete =
    !result.error &&
    result.signal == null &&
    result.status !== null &&
    Buffer.byteLength(result.stdout || "") <= OUTPUT_CAPTURE_BYTES &&
    Buffer.byteLength(result.stderr || "") <= OUTPUT_CAPTURE_BYTES;
  let reason = "capture-incomplete";
  if (complete) reason = "complete";
  else if (result.error?.code === "ETIMEDOUT") reason = "timeout";
  return {
    stdout: capturePrefix(result.stdout),
    stderr: capturePrefix(result.stderr),
    _outputCapture: {
      complete,
      reason,
    },
  };
}

export function dispatchCaptureSettings(enabled) {
  if (enabled)
    return {
      maxBuffer: OUTPUT_CAPTURE_BYTES,
      projectOutput: captureProcessOutput,
    };
  return { maxBuffer: 1024 * 1024, projectOutput: () => ({}) };
}

function redact(text) {
  let safe = String(text ?? "");
  const values = Object.entries(process.env)
    .filter(
      ([name, value]) =>
        /SECRET|TOKEN|PASSWORD|PASSWD|API[_-]?KEY|PRIVATE[_-]?KEY|CREDENTIAL/i.test(
          name,
        ) && value?.length >= 8,
    )
    .map(([, value]) => value)
    .sort((left, right) => right.length - left.length);
  for (const value of values) safe = safe.replaceAll(value, "[REDACTED]");
  return safe
    .replace(
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|$)/g,
      "[REDACTED]",
    )
    .replace(
      /\b(?:gh[pousr]_\w+|github_pat_\w+|AKIA[A-Z0-9]{16})\b/g,
      "[REDACTED]",
    )
    .replace(/\b(Bearer\s+)[a-z0-9._~+/-]+=*/gi, "$1[REDACTED]");
}

function safeOutput(payload) {
  const capture = payload._outputCapture ?? {
    complete: false,
    reason: "not-captured",
  };
  const result = { ...payload, capture };
  delete result._outputCapture;
  for (const field of [
    "stdout",
    "stderr",
    "error",
    "command",
    "commandResolved",
  ]) {
    if (typeof result[field] !== "string") continue;
    let text = result[field];
    if (!capture.complete && (field === "stdout" || field === "stderr"))
      text = text.slice(0, text.lastIndexOf("\n") + 1);
    result[field] = redact(text);
  }
  return result;
}

function callerKey(caller) {
  if (caller?.valid !== true) return null;
  const teams = caller.teams || [];
  if (!Array.isArray(teams) || teams.some((team) => typeof team !== "string"))
    return null;
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: caller.callerId,
        token: caller.token,
        role: caller.role,
        teams: [...teams].sort((left, right) =>
          left.localeCompare(right, "en"),
        ),
      }),
    )
    .digest("hex");
}

export class OutputStore {
  constructor({
    now = Date.now,
    ttlMs = 300000,
    maxEntries = 16,
    maxBytes = 1048576,
  } = {}) {
    this.now = now;
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.entries = new Map();
    this.bytes = 0;
  }

  expire() {
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt <= this.now()) {
        this.entries.delete(id);
        this.bytes -= entry.bytes;
      }
    }
  }

  clear() {
    this.entries.clear();
    this.bytes = 0;
  }

  retain(payload, caller) {
    this.expire();
    const owner = callerKey(caller);
    if (!owner) return { state: "missing-caller" };
    if (!payload._outputCapture) return { state: "not-captured" };
    const safe = safeOutput(payload);
    const stdout = safe.stdout || "";
    const stderr = safe.stderr || "";
    const outputBytes = Buffer.byteLength(stdout) + Buffer.byteLength(stderr);
    const bytes =
      outputBytes +
      Buffer.byteLength(
        JSON.stringify({
          owner,
          command: payload.command,
          capture: safe.capture,
        }),
      ) +
      128;
    if (
      outputBytes > 262144 ||
      this.entries.size >= this.maxEntries ||
      this.bytes + bytes > this.maxBytes
    )
      return { state: "capacity-exceeded" };
    const id = randomUUID();
    const expiresAt = this.now() + this.ttlMs;
    this.entries.set(id, {
      stdout,
      stderr,
      bytes,
      owner,
      expiresAt,
      command: payload.command,
      capture: safe.capture,
    });
    this.bytes += bytes;
    const base = `io.modelcontextprotocol/harness/output/${id}`;
    return {
      state: "retained",
      stdoutUri: `${base}/stdout/0`,
      stderrUri: `${base}/stderr/0`,
      expiresAt,
      redacted: true,
    };
  }

  read(uri, caller, authorize) {
    this.expire();
    const match =
      /^io\.modelcontextprotocol\/harness\/output\/([a-f0-9-]{36})\/(stdout|stderr)\/(0|[1-9]\d*)$/.exec(
        uri,
      );
    if (!match) return null;
    const entry = this.entries.get(match[1]);
    if (
      !entry ||
      entry.owner !== callerKey(caller) ||
      !authorize(entry.command, caller)
    )
      return null;
    const text = entry[match[2]];
    const offset = Number(match[3]);
    if (
      !Number.isSafeInteger(offset) ||
      offset > text.length ||
      /[\uDC00-\uDFFF]/.test(text[offset] || "")
    )
      return null;
    const page = safePrefix(text.slice(offset), 1024);
    const nextOffset = offset + page.length;
    return markUntrustedResult({
      contents: [{ uri, mimeType: "text/plain", text: page }],
      _meta: {
        coverage: {
          nextUri:
            nextOffset < text.length
              ? `io.modelcontextprotocol/harness/output/${match[1]}/${match[2]}/${nextOffset}`
              : null,
          sourceBytes: Buffer.byteLength(text),
          sha256: createHash("sha256").update(text).digest("hex"),
          capture: entry.capture,
          redacted: true,
        },
      },
    });
  }
}

function toolReply(payload, ok) {
  const envelope = ok
    ? payload
    : {
        ok: false,
        tool: "harness-command-dispatch",
        exitCode: payload.exitCode,
        result: payload,
      };
  return markUntrustedResult({
    ...(ok ? {} : { isError: true }),
    structuredContent: payload,
    content: [{ type: "text", text: JSON.stringify(envelope) }],
  });
}

export function boundDispatchReply(reply, responseBytes) {
  if (Buffer.byteLength(JSON.stringify(reply)) <= responseBytes) return reply;
  const original = reply.structuredContent || {};
  return toolReply(
    {
      ok: original.ok ?? false,
      exitCode: original.exitCode,
      status: original.status,
      error: "Dispatch response exceeded the serialized byte budget",
      retainedOutput: original.retainedOutput,
      capture: original.capture,
    },
    false,
  );
}

export function buildDispatchReply(
  payload,
  { ok, store, caller, responseBytes },
) {
  const safe = safeOutput(payload);
  const retainedOutput = store.retain(payload, caller);
  let limit = 1024;
  while (true) {
    const preview = { ...safe, retainedOutput };
    for (const field of ["stdout", "stderr"]) {
      if (typeof safe[field] === "string")
        preview[field] = safePrefix(safe[field], limit);
    }
    const reply = toolReply(preview, ok);
    if (Buffer.byteLength(JSON.stringify(reply)) <= responseBytes) return reply;
    if (limit === 0) return boundDispatchReply(reply, responseBytes);
    limit = Math.floor(limit / 2);
  }
}
