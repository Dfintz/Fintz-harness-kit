#!/usr/bin/env node

import assert from "node:assert/strict";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function extractErrorDetails(error) {
  if (!error || typeof error !== "object") {
    return { message: String(error), code: undefined };
  }
  let message = String(error);
  if (typeof error.message === "string") {
    message = error.message;
  } else if (typeof error.toString === "function") {
    message = error.toString();
  }

  let code;
  if (typeof error.code === "number") {
    code = error.code;
  } else if (typeof error.code === "string") {
    code = Number(error.code);
  }
  return { message, code };
}

async function run() {
  console.log("[mcp-stdio-slice-b] Starting SDK-client MRTR stdio parity test...");

  const client = new Client(
    { name: "harness-mcp-stdio-slice-b-test", version: "1.0.0" },
    { capabilities: {} },
  );

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["scripts/harness/mcp-server.mjs"],
    cwd: process.cwd(),
    stderr: "pipe",
    env: {
      ...process.env,
    },
  });

  const stderrChunks = [];
  if (transport.stderr) {
    transport.stderr.on("data", (chunk) => {
      stderrChunks.push(String(chunk));
    });
  }

  try {
    // connect() performs MCP initialization handshake for us.
    await client.connect(transport);

    const listed = await client.listTools();
    assert.ok(Array.isArray(listed.tools), "T0: listTools should return a tools array");
    assert.ok(
      listed.tools.some((tool) => tool.name === "harness-catalog"),
      "T0: harness-catalog should be discoverable",
    );
    console.log("PASS T0: SDK client initialized and tools listed");

    const kickoff = await client.callTool({
      name: "harness-catalog",
      arguments: {
        __mrtr: {
          requiredInputs: [{ name: "approval", description: "Approve execution" }],
        },
      },
    });

    assert.equal(
      kickoff?.structuredContent?.resultType,
      "input_required",
      "T1: kickoff should return resultType=input_required",
    );
    assert.ok(
      typeof kickoff?.structuredContent?.requestToken === "string" &&
        kickoff.structuredContent.requestToken.length > 10,
      "T1: requestToken should be present",
    );
    assert.ok(
      Array.isArray(kickoff?.structuredContent?.requiredInputs),
      "T1: requiredInputs should be present",
    );
    console.log("PASS T1: MRTR kickoff returns input_required over stdio SDK client");

    const resume = await client.callTool({
      name: "harness-catalog",
      arguments: {
        requestToken: kickoff.structuredContent.requestToken,
        inputResponses: {
          approval: "yes",
        },
      },
    });

    assert.equal(
      resume?.structuredContent?.ok,
      true,
      "T2: resumed call should execute tool successfully",
    );
    assert.ok(
      resume?.structuredContent?.catalog && typeof resume.structuredContent.catalog === "object",
      "T2: resumed call should return harness catalog payload",
    );
    console.log("PASS T2: MRTR resume with inputResponses executes tool");

    let invalidError = null;
    let invalidResult = null;
    try {
      invalidResult = await client.callTool({
        name: "harness-catalog",
        arguments: {
          requestToken: "invalid-token",
          inputResponses: {
            approval: "yes",
          },
        },
      });
    } catch (error) {
      invalidError = error;
    }

    if (invalidError) {
      const details = extractErrorDetails(invalidError);
      assert.ok(
        details.message.includes("Invalid MRTR requestToken") || details.code === -32602,
        `T3: invalid token failure should be invalid-params-like; got message=${details.message} code=${String(details.code)}`,
      );
    } else {
      assert.equal(
        invalidResult?.isError,
        true,
        "T3: invalid token should produce an error result",
      );
    }
    console.log("PASS T3: invalid MRTR requestToken is rejected");

    console.log("✅ Slice B stdio SDK-client MRTR test passed");
  } finally {
    try {
      await transport.close();
    } catch {
      // Best-effort shutdown in tests.
    }

    if (stderrChunks.length > 0) {
      const joined = stderrChunks.join("").trim();
      if (joined) {
        process.stderr.write(`[mcp-stdio-slice-b][server-stderr]\n${joined}\n`);
      }
    }
  }
}

try {
  await run();
} catch (err) {
  console.error(`❌ Slice B stdio SDK-client test failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
