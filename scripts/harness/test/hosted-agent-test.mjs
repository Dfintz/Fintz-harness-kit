#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  AgentConfigError,
  inferProvider,
  resolveEndpoint,
  validateModelId,
} from "../hosted-agent.mjs";

const agentPath = join(dirname(fileURLToPath(import.meta.url)), "..", "hosted-agent.mjs");
const FAKE_KEY = "sk-test-do-not-leak-1234567890";

function startMock(handler) {
  return new Promise((resolveServer) => {
    const requests = [];
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        requests.push({ url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null });
        const { status = 200, json } = handler(req);
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(json));
      });
    });
    server.listen(0, "127.0.0.1", () => resolveServer({ server, requests, port: server.address().port }));
  });
}

function runAgent(args, env, input = "PROMPT") {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [agentPath, ...args], {
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolveRun({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

const cases = [
  {
    provider: "openai", model: "gpt-5.6-terra", keyEnv: "OPENAI_API_KEY", path: "/chat/completions",
    reply: { choices: [{ message: { content: "openai text" } }] }, expect: "openai text",
    auth: (headers) => headers.authorization === `Bearer ${FAKE_KEY}`,
  },
  {
    provider: "azure-openai", model: "my-terra-deployment", keyEnv: "AZURE_OPENAI_KEY", path: "/chat/completions",
    reply: { choices: [{ message: { content: "azure text" } }] }, expect: "azure text",
    auth: (headers) => headers["api-key"] === FAKE_KEY && !headers.authorization,
  },
  {
    provider: "anthropic", model: "claude-opus-5-5", keyEnv: "ANTHROPIC_API_KEY", path: "/messages",
    reply: { content: [{ type: "text", text: "claude text" }] }, expect: "claude text",
    auth: (headers) => headers["x-api-key"] === FAKE_KEY && headers["anthropic-version"] === "2023-06-01",
  },
  {
    provider: "gemini", model: "gemini-3.8-flash", keyEnv: "GEMINI_API_KEY", path: "/models/gemini-3.8-flash:generateContent",
    reply: { candidates: [{ content: { parts: [{ text: "gemini text" }] } }] }, expect: "gemini text",
    auth: (headers) => headers["x-goog-api-key"] === FAKE_KEY,
  },
];

for (const entry of cases) {
  test(`${entry.provider}: request shape, auth header, and text extraction`, async () => {
    const mock = await startMock(() => ({ json: entry.reply }));
    try {
      const result = await runAgent(
        ["--provider", entry.provider, "--base-url", `http://127.0.0.1:${mock.port}`, "--allow-host", "127.0.0.1"],
        { [entry.keyEnv]: FAKE_KEY, HARNESS_EVAL_MODEL: entry.model },
      );
      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.stdout.trim(), entry.expect);
      const [request] = mock.requests;
      assert.equal(request.url, entry.path);
      assert.ok(entry.auth(request.headers), "provider auth header");
      assert.ok(!request.url.includes(FAKE_KEY), "key must not be in the URL");
      assert.ok(JSON.stringify(request.body).includes("PROMPT"));
    } finally {
      mock.server.close();
    }
  });
}

test("HTTP errors report status only and never echo the key or body", async () => {
  const mock = await startMock(() => ({ status: 401, json: { error: `bad key ${FAKE_KEY}` } }));
  try {
    const result = await runAgent(
      ["--provider", "openai", "--model", "gpt-5.4", "--base-url", `http://127.0.0.1:${mock.port}`, "--allow-host", "127.0.0.1"],
      { OPENAI_API_KEY: FAKE_KEY },
    );
    assert.equal(result.code, 1);
    assert.match(result.stderr, /openai returned HTTP 401/);
    assert.ok(!result.stderr.includes(FAKE_KEY));
    assert.ok(!result.stdout.includes(FAKE_KEY));
  } finally {
    mock.server.close();
  }
});

test("loopback and untrusted hosts are refused without --allow-host, before any request", async () => {
  const mock = await startMock(() => ({ json: {} }));
  try {
    const result = await runAgent(
      ["--provider", "openai", "--model", "gpt-5.4", "--base-url", `http://127.0.0.1:${mock.port}`],
      { OPENAI_API_KEY: FAKE_KEY },
    );
    assert.equal(result.code, 2);
    assert.match(result.stderr, /not trusted/);
    assert.equal(mock.requests.length, 0, "no request may reach an untrusted host");
  } finally {
    mock.server.close();
  }
});

test("endpoint policy: trusted hosts, https, no embedded credentials", () => {
  assert.equal(resolveEndpoint("openai", undefined, []), "https://api.openai.com/v1");
  assert.equal(resolveEndpoint("azure-openai", "https://res.openai.azure.com/openai/v1/", []), "https://res.openai.azure.com/openai/v1");
  assert.throws(() => resolveEndpoint("openai", "https://evil.example.com/v1", []), /not trusted/);
  assert.throws(() => resolveEndpoint("anthropic", "https://api.openai.com/v1", []), /not trusted/);
  assert.throws(() => resolveEndpoint("openai", "http://api.openai.com/v1", []), /https/);
  assert.throws(() => resolveEndpoint("openai", "http://proxy.internal/v1", ["proxy.internal"]), /https/);
  assert.throws(() => resolveEndpoint("openai", "https://u:p@api.openai.com/v1", []), /credentials/);
  assert.equal(resolveEndpoint("openai", "https://proxy.internal/v1", ["proxy.internal"]), "https://proxy.internal/v1");
});

test("model ids are validated per provider; traversal-like ids are rejected", () => {
  for (const bad of ["../models/x", "gemini/../x", "a b", "", "x?key=1", "%2e%2e"]) {
    assert.throws(() => validateModelId("gemini", bad), AgentConfigError, bad);
  }
  assert.throws(() => validateModelId("openai", "../x"), AgentConfigError);
  assert.equal(validateModelId("openai", "openai/gpt-5.6-terra"), "openai/gpt-5.6-terra");
  assert.equal(validateModelId("gemini", "gemini-3.8-flash"), "gemini-3.8-flash");
});

test("auto provider covers only unambiguous prefixes", () => {
  assert.equal(inferProvider("claude-haiku-4-5"), "anthropic");
  assert.equal(inferProvider("gemini-3.8-flash"), "gemini");
  assert.equal(inferProvider("gpt-6-sol"), "openai");
  for (const model of ["mai-code-1.1-flash", "qwen2.5-coder:14b", "my-azure-deployment"]) {
    assert.throws(() => inferProvider(model), /--provider/, model);
  }
});

test("missing key names the env var and the --pass-env hint", async () => {
  const result = await runAgent(["--model", "claude-sonnet-5"], {});
  assert.equal(result.code, 2);
  assert.match(result.stderr, /ANTHROPIC_API_KEY/);
  assert.match(result.stderr, /--pass-env ANTHROPIC_API_KEY/);
});
