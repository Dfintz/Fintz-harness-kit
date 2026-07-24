## Architecture Brief — davis7dotsh/my-pi-setup Cherry-Pick

resource: https://github.com/davis7dotsh/my-pi-setup, AGENTS.md

### Objective

Cherry-pick the one applicable pattern from `my-pi-setup` into the harness-kit: the "ask one
question at a time" interaction principle from the repo's AGENTS.md. Add a radar entry for the
thinking-budget token mapping (parked — informative but no tooling hook in the current harness).

### Assessment

`my-pi-setup` is a personal configuration for the `@earendil-works/pi-ai` agent environment
(v0.82.0). The overwhelming majority of its content — extensions (background-terminals, subagents,
file-search, firecrawl, etc.), skills (bg_start/bg_kill API, pi/claude/codex harness invocation),
model aliases (gpt-5.6-sol, claude-fable-5), and theme — is specific to the pi tool and has no
applicable mapping to the harness-kit's toolchain.

One principle survives the adoption gate: "ask questions one at a time" from the repo's AGENTS.md.
This is a universal human-interaction discipline not currently stated in the harness docs.

### Scope and boundaries

**In scope:**
- `.github/harness/HARNESS.md` — add "ask one question at a time" to the human-interaction section
- New radar entry for thinking-budget token mapping (parked)

**Out of scope:**
- All pi extensions, bg_* API, subagent harness invocations, model aliases
- TypeScript/SvelteKit coding conventions (wrong stack for this kit)
- Thinking budget token values (no tooling hook in the current harness runner)

### Artifacts to modify

- `.github/harness/HARNESS.md` — find the human-interaction / cross-model review section and add
  one sentence: when the agent needs clarification, ask one question at a time

### Key decisions

- **Decision:** Only `ask-one-question` is cherry-pickable; everything else is pi-specific.
- **Decision:** Thinking budget mapping goes to radar as parked — informative, not actionable yet.

### Constraints

- Additive text only; one sentence addition
- Must not duplicate content already in HARNESS.md

### Validation plan

- `npm run harness:docs:check` must pass after the edit
- `npm run harness:eval --self-test` to confirm no regressions

### Do NOT

- Do not add pi-specific tooling (bg_start, subagent_spawn, etc.) to any harness file
- Do not add the pi model aliases to harness.config.json
- Do not add TypeScript conventions — the kit is .mjs

### Assumptions and risks

| Assumption | Affects | Risk if wrong |
|---|---|---|
| HARNESS.md has a human-interaction or clarification section | Implementation target | Low — if not, add to the Interact section of the relevant stage instruction |
