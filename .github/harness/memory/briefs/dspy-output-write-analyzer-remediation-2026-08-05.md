---
summary: "Architecture Brief: DSPy Output Write Analyzer Remediation - 2026-08-05"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [security, dspy, output-path, analyzer]
---

# Architecture Brief: DSPy Output Write Analyzer Remediation - 2026-08-05

resource: scripts/harness/dspy-optimize-ollama.py, .github/harness/memory/reviews/harness-full-review-2026-08-05-feedback.md

## Architecture Brief

### Objective

- Remove the analyzer rule `Potential file inclusion attack via reading file` at `save_file`'s `Path.write_text` sink while retaining its repository-contained output contract.

### Scope and boundaries

- In scope: `scripts/harness/dspy-optimize-ollama.py` output-path validation and focused self-test coverage.
- Out of scope: model prompting, optimizer behavior, input/eval path policy, and broader analyzer configuration.
- Primary boundary: CLI output path to filesystem write.

### Artifacts to create

- `.github/harness/memory/briefs/dspy-output-write-analyzer-remediation-2026-08-05.md` - decision and validation record.

### Artifacts to modify

- `scripts/harness/dspy-optimize-ollama.py` - perform the existing repository containment check inline in `save_file` immediately before parent creation and `Path.write_text`, making the trusted write boundary visible to static analysis without widening writable scope.

### Key decisions

- Gate 1 (domain alignment): PASS. The optimizer owns its output-path validation.
- Gate 2 (generality): PASS. Do not create a cross-tool Python filesystem abstraction for one CLI boundary.
- Gate 3 (ownership): PASS. `save_file` owns an inline output containment check immediately before mutation.
- Gate 4 (boundary integrity): PASS. CLI parsing remains delivery-only; output validation stays in the filesystem helper.
- Gate 4b (isolation and safety): PASS with focused hardening. Writes must remain inside the repository and reject traversal or external absolute paths.
- Gate 5 (reuse): PASS. Reuse existing repository-root policy; add only an output-specific wrapper if it makes the analyzer-visible boundary explicit.

### Constraints

- Preserve `--output` behavior for valid nested repository-relative paths and valid absolute paths contained by the repository.
- Reject paths outside the repository before parent directory creation or writing.
- Do not silence the warning with comments or analyzer exclusions.

### Validation plan

- Run the optimizer self-test and Python compilation.
- Verify a valid nested repository-relative output path and a valid repo-contained absolute output path succeed.
- Verify traversal and external absolute output paths are rejected without creating files.
- Run `npm run harness:security:lurkr`, `npm run harness:docs:check`, and file diagnostics.

### Do NOT

- Do NOT weaken the existing repository containment policy.
- Do NOT make output location machine-specific or hardcode a single artifact filename.

### Assumptions and risks

- [UNVERIFIED] The analyzer recognizes the inline containment check at the `Path.write_text` sink while preserving valid nested and repo-contained absolute output paths.
- Risk: Over-restricting output paths would break documented usage; focused valid/invalid path tests mitigate this.