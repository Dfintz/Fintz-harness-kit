---
summary: "Architecture Brief — Ubuntu/Ollama File Search & Analysis Toolkit + Prompt Middleware Layer"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [ubuntu, ollama, file, search]
---
# Architecture Brief — Ubuntu/Ollama File Search & Analysis Toolkit + Prompt Middleware Layer

resource: scripts/harness/vector-search.mjs, scripts/harness/llm-provider.mjs, scripts/harness/prompt-router.mjs, scripts/harness/mcp-tools.mjs, harness.config.json, package.json, SETUP.md

**Date:** 2026-08-03  
**Author stage:** Architect (gpt-5.6-luna / inline)  
**Status:** APPROVED (inline skeptical pass — see below)

---

## Problem

The harness has Ollama integration but its semantic index only covers harness memory docs (lessons,
briefs, graph nodes). On a 50 GB Intel CPU Ubuntu server it cannot index and semantically search
arbitrary filesystems. Additionally the prompt-router exists as a CLI tool but is not exposed as an
importable middleware layer that every incoming prompt can pass through automatically.

---

## Goals

1. **Filesystem vector index** — index any directory tree via `--root <path>` with automatic chunking,
   binary skip, and incremental (mtime+hash) re-index.
2. **Dedicated `file-search` CLI** — thin UX wrapper for file-first queries.
3. **Prompt middleware** — importable + CLI layer that routes any prompt through the harness stage
   machine and returns a structured JSON handoff.
4. **Hardware profile config** — document recommended model + Ollama tuning for 50 GB CPU-only Intel.
5. **Ubuntu setup guidance** — systemd, Node version, environment variables in `SETUP.md`.

---

## Gate 1 — Ownership & Layer

| Item | Owner | Layer |
|---|---|---|
| `vector-search.mjs` | harness engine | data / retrieval |
| `file-search.mjs` (new) | harness engine | CLI convenience |
| `prompt-middleware.mjs` (new) | harness engine | routing / orchestration |
| `harness.config.json` | operator config | configuration |
| `SETUP.md` | operator docs | documentation |

No ownership boundary crossed. All changes stay inside the harness engine layer.

---

## Gate 2 — Reuse & Duplication

- `llm-provider.mjs` `embedOne()` — reused as-is for filesystem doc embedding.
- `prompt-router.mjs` `planTask()` — exported and reused inside `prompt-middleware.mjs`; no logic
  duplication.
- Chunking lives only in `vector-search.mjs`; no second chunker.

---

## Gate 3 — Data Shape & Contracts

### New `fs` scope in the vector index

Existing scope tokens: `lessons`, `briefs`, `graph`. Added: `fs`.

```
document {
  id:           "fs:<sha256(absPath)>:<chunkIdx>"   // stable, deterministic
  scope:        "fs"
  kind:         "filesystem-chunk"
  name:         "<relative path>:<chunkIdx>"
  title:        "<first meaningful line of chunk>"
  summary:      "<first meaningful line of chunk>"
  path:         "<absolute path>"
  chunkIndex:   <number>
  chunkTotal:   <number>
  sourceMtimeMs: <number>
  textHash:     "<sha256 of id+embeddingInput>"
  model:        "<embed model>"
  embedding:    [...]
  preview:      "<280 char truncation>"
  indexedAt:    "<iso8601>"
}
```

Backward compat: existing indexes without `fs` docs are valid; `fs` docs are additive. The `scope`
field gates carry-forward logic — non-`fs` scopes are unaffected.

### Prompt middleware handoff contract

```
{
  "task": "<original prompt>",
  "profile": "<profile | null>",
  "intent": "<intent | null>",
  "mode": "trivial | non-trivial",
  "stages": ["understand", ...],
  "models": { "<stage>": "<model>", ... },
  "crossModelReview": "<string>",
  "handoff": "<human-readable multi-line stage table>"
}
```

---

## Gate 4 — Security & Safety

- Filesystem walker reads files; it does NOT execute them. Files are treated as untrusted text.
- Binary skip via null-byte detection — prevents embedding binary blobs.
- Max file size cap (512 KB default, `HARNESS_FS_MAX_FILE_BYTES` override) — prevents memory pressure.
- Path traversal: walker resolves absolute paths; symlinks are followed only within the declared root
  (no `..` escape beyond root). Actually: we use `realpathSync` and check that the resolved path
  starts with the root prefix.
- Prompt middleware: input is passed to `planTask()` only — it is never `eval`-ed or executed.
  Prompt injection via task text cannot affect the harness engine (it only determines stage/model
  routing, not code execution).

### Gate 4b — No new permissions widened
The middleware exposes routing metadata only. It does not write files, run commands, or bypass any
existing guardrail.

---

## Gate 5 — Validation Surface

| What | Command |
|---|---|
| Filesystem index smoke test | `node scripts/harness/vector-search.mjs index --root . --scope fs --provider ollama` |
| File search query | `node scripts/harness/file-search.mjs --query "chunking" --root .` |
| Prompt middleware JSON | `echo "add file search" \| node scripts/harness/prompt-middleware.mjs --json` |
| Config JSON validity | `node -e "JSON.parse(require('fs').readFileSync('harness.config.json','utf8'))"` |

---

## Files Changed

| File | Action | Reason |
|---|---|---|
| `scripts/harness/vector-search.mjs` | Edit | Add `--root`, `readFilesystemDocuments()`, chunking, `fs` scope |
| `scripts/harness/file-search.mjs` | Create | Thin CLI for filesystem search |
| `scripts/harness/prompt-middleware.mjs` | Create | Harness routing middleware |
| `package.json` | Edit | Add `harness:search`, `harness:file-index`, `harness:prompt:route` |
| `harness.config.json` | Edit | Add `hardwareProfile` block |
| `SETUP.md` | Edit | Add Ubuntu/Ollama section |

---

## Do-NOTs

- Do NOT change the existing index document format for lessons/briefs/graph scopes.
- Do NOT require any npm dependency not already in the repo (use Node built-ins only).
- Do NOT touch `mcp-server.mjs` — out of blast radius for this change.
- Do NOT hardcode absolute paths.
- Do NOT follow symlinks outside the declared `--root`.
- Do NOT execute any file content — embedding only.

---

## Assumptions

- Node.js ≥ 18 (native `fetch`, `node:fs`, `node:crypto`).
- Ollama is accessible at `HARNESS_LLM_HOST` / `OLLAMA_HOST` (default `http://localhost:11434`).
- The operator has pulled an embedding model (default: `nomic-embed-text`).
- The `prompt-router.mjs` `planTask()` function is exported (currently it is a named export — confirmed).

---

## Inline Skeptical Pass (Architect-Challenge fallback)

**Challenge 1:** Chunking creates many more index documents — will cosine search still return file-level results?  
**Response:** Each chunk carries `path` and `chunkIndex`. The search output groups results by path when `--group-by-file` is passed, and the default output already shows `path` in the result. Acceptable.

**Challenge 2:** Binary skip via null-byte is not 100% reliable for UTF-16 files.  
**Response:** UTF-16 files will have null bytes and be skipped. Acceptable — UTF-16 is rare in source/log corpora and users can force-include via `--allow-binary` if needed. Document this.

**Challenge 3:** Prompt middleware exposes `planTask()` — could a malicious prompt manipulate routing?  
**Response:** `planTask()` only matches against a config-driven intent table and returns stage names from a fixed enum. There is no dynamic code path. Injection-safe.

**VERDICT: APPROVED**
