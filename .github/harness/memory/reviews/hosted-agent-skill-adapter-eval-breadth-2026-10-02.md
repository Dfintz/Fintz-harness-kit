# Review Breadth — Hosted Agent for Skill Adapter Eval (2026-10-02)

Brief: `.github/harness/memory/briefs/hosted-agent-skill-adapter-eval-2026-10-02.md`

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | Medium | No hosted family has live results yet: this environment has no provider keys, the Copilot CLI is not installed, and GitHub Models is retired. | Operator action: run with a vendor key. The no-key end-to-end run is recorded as invalid, not scored. |
| 2 | Low | `measure-phase5c-real.mjs` still targets the retired GitHub Models endpoint (`models.inference.ai.github.com`). | Out of scope; follow-up. |
| 3 | Low | The `ollama run` guard is lexical; a wrapper script can bypass it. | Accepted; documented as best-effort. |
| 4 | Low | `--agent` with a relative script path depends on the current directory (the runner does not set `cwd`). | Same as the existing `run-eval.mjs` contract; documented examples run from the repo root. |
| 5 | Info | Sonar flags two `http://` literals in `hosted-agent-test.mjs`; both are negative tests asserting http is rejected. | No action. |

## Proof

- `npm run test:harness:hosted-agent`: 10/10. All 4 provider request shapes and auth headers were
  checked against a local mock. Also covered: key never in URL, stderr, or stdout on HTTP 401;
  untrusted and loopback hosts refused before any request; https and no embedded credentials;
  traversal-style model ids rejected; narrowed `auto`; missing-key hint.
- `npm run test:harness:skill-adapter-eval`: 9/9 (adds the guard, family/alias resolution, and
  validity-gated signal).
- `test:harness:core` exits 0; `harness:docs:check` and `harness:commands:check` OK.
- CLI: an `ollama run` agent exits 2 with guidance. A hosted run without a key yields
  `inconclusive (insufficient-valid-repeats), 1 invalid cases`.
