---
type: brief
status: active
summary: Pinned SkillSpector evidence and a blocked, source-only comparison design for Cloudflare security-review techniques; no integration or pilot execution.
created: 2026-10-22
updated: 2026-10-22
tags: [security, external-skill, evaluation, source-only]
---

# Cloudflare Source-Only Security Pilot

## Architecture Brief

### Objective

Determine whether explicit coverage accounting and independent candidate refutation improve
the existing security-review lane at an acceptable cost. The falsifiable hypothesis is that
the variant identifies more planted boundary defects or rejects more unsupported claims,
without losing baseline detections or inventing vulnerabilities on clean controls.

Status: design recorded; execution and adoption blocked. This is not a published skill,
documentation-only adoption, approved runner, or completed comparison. No detection improvement
has been measured. The cheapest discriminating check is a paired review of the fixed cases
below, not a full audit of this repository.

### Scope and boundaries

- Target corpus: source-only packets derived from the committed harness revision `b7b3387fcc3e0227d5cd4cac00d013ca816d293e`, not the dirty worktree. Freeze packet contents, intentional mutations, input objects, expected outcomes, and SHA-256 hashes before either arm runs.
- Owners: [security gate](../../../../scripts/harness/security-review-gate.mjs) with its [tests](../../../../scripts/harness/test/security-review-gate-test.mjs), and [memory access evaluator](../../../../scripts/harness/memory-access-control.mjs) with its [ACL scenarios](../../../../scripts/harness/test/mcp-memory-acl-e2e-test.mjs). Test source supplies scenarios; tests are not run by the pilot.
- Baseline: the current [Breadth](../../../instructions/05-REVIEW-BREADTH.md), [Depth](../../../instructions/06-REVIEW-DEPTH.md), and [doubt-driven](../../../skills/doubt-driven-development/SKILL.md) requirements, frozen with the corpus. Existing independent review is present in both arms.
- Variant: the same baseline plus one bounded experimental augmentation: explicit coverage units and a required refutation record for each candidate. Do not load the external skill or materialize that augmentation until its adoption gate is cleared.
- No target-controlled execution, build, test, browser, fixture runner, fuzzer, validator, dependency installation, endpoint access, or ambient credentials. Synthetic input objects are read as text. Do not execute them to establish ground truth.
- Out of scope: installing the skill, changing routing/stage contracts, adapting the security gate, full six-phase audits, production exploitability claims, and sandbox or Windows-validator implementation.

The eight planned cases are synthetic review inputs, not claims of defects in current code:

| Case | Fixed source/input change | Ground-truth disposition |
| --- | --- | --- |
| G1 | In a disposable gate-source packet, remove the report-status check; supply `status: skipped`, an otherwise valid checklist, and an approved review. | Planted evidence-acceptance defect: skipped evidence must not pass. |
| G2 | Remove the required checklist-ID check; supply an otherwise valid report missing `base-and-head-scans-recorded`. | Planted evidence-completeness defect: missing scan evidence must not pass. |
| M1 | In a disposable evaluator packet, change an explicit matching zone-deny result to allow; include a fixed matching caller and entry. | Planted authorization-contract defect: explicit denial must win. |
| M2 | Change an allow-rule miss to inherit global `defaultAllow: true`; include a restricted zone and an outsider. | Planted authorization-contract defect: an outsider must remain denied. |
| C1 | Unmodified gate, complete checklist, recorded successful scans, and approved converged review. | Clean control for the stated evidence contract; no invented bypass. |
| C2 | Unmodified evaluator with explicit zone rules and the existing allowed/outsider scenario pair. | Clean control for the stated authorization contract; no invented bypass. |
| U1 | Gate contract and candidate claim supplied without the scan receipts needed to establish that a real run passed or failed. | Validation gap, not a confirmed runtime finding or clean security verdict. |
| U2 | Evaluator source supplied without the transport/authentication boundary; claim that arbitrary callers can forge a privileged role. | Validation gap: caller authenticity is not established by this packet. |

Maintain an evaluator-only answer key outside reviewer-visible context. A human checks that each
mutation is exactly the intended contract violation, clean cases retain their protections, and
withheld-context cases cannot be settled from the visible packet. If a case is ambiguous, stop
and version the corpus before running either arm; do not relabel cases after seeing outputs.

### Artifacts to create

- This Brief and the unchanged, public-source [SkillSpector report](../reviews/cloudflare-security-audit-skillspector-2026-10-22.json) are the only new persisted artifacts for this follow-up.
- After separate approval, create an external, parent-owned pilot output directory containing `case-manifest.json`, the hidden answer key, frozen arm inputs, per-case reviewer/verifier records, and `comparison.json`. Retain no real secrets or unrelated source. Do not create these pilot artifacts during design.
- The case manifest must record source commit/blob identities, packet hashes, exact mutations, visible/withheld dependencies, and the answer-key revision. Store per-call model/provider revisions, prompt hashes, effective capabilities, budget receipts, timestamps, and terminal reasons alongside outputs.
- A future comparison record must retain every case/arm/repetition, including timeouts and rejected malformed outputs. No results have been generated here.

### Artifacts to modify

- Update only the [radar entry](../radar/cloudflare-security-audit-skill.md) with scan provenance, triage, blockers, and this design reference.
- Do not modify current review instructions, published skills, runtime scripts, configuration, dependencies, or existing tests. An eventual workflow change needs a separate approved Brief and aligned agent surfaces.

### Key decisions

**Scan evidence.** Acquired detached source snapshots outside the workspace, with hooks disabled,
no submodules, and exact commit verification. Both source checkouts remained clean after scanning.

| Provenance | Recorded value |
| --- | --- |
| Target | [Cloudflare security-audit-skill](https://github.com/cloudflare/security-audit-skill/tree/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8), commit `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` |
| Skill subtree | `skills/security-audit`, Git tree `ccbc33ed119b28c3ef7b44a7e2081ab191ad63af` |
| Scanner | [NVIDIA SkillSpector](https://github.com/NVIDIA/SkillSpector/tree/d7338f58200a9ae2a24810cee08911ab68b107a7), commit `d7338f58200a9ae2a24810cee08911ab68b107a7`, installed package version `2.12.0` |
| Environment | Native Windows, CPython `3.13.15`; temporary bootstrap uv `0.13.5`; isolated scanner environment, `uv sync --frozen --no-dev --no-editable --no-config` |
| Dependency lock SHA-256 | `86da392895db777270d9f1e2390c6956df2beaae31578235389d584fafe10adc` |
| Command | `skillspector scan <pinned-checkout>/skills/security-audit --no-llm --format json --fail-on-findings --fail-on-incomplete --min-coverage 100` |
| Capture | JSON stdout captured by the trusted parent into a new file; no unsupported Windows `--output`, baseline, suppression, exclusion, or transitive scan |
| Result | Exit `1`; execution successful, but gates failed; `100/100`, `CRITICAL` aggregate risk, `DO_NOT_INSTALL`; 14 findings: 10 HIGH, 3 MEDIUM, 1 LOW |
| Completeness | `partial`, 75%; 15 fully inspected files, 5 partially inspected, 0 entirely uninspected; 20 components |
| LLM/cost | `llm_requested: false`, `llm_available: false`, empty inference usage; no model calls; elapsed scan time `24.888` seconds |
| Raw report | 62,179 bytes; SHA-256 `dde65c7c7121117169fecf85ce6ac1479b76eaeb85b85915705fe8aa73bc29aa` |

The actual package version, rather than the repository's advertised release label, identifies
this build together with the commit and lock hash. The scanner received an allowlisted process
environment without inherited provider credentials or tracing. This was not an OS sandbox.
Static mode may send dependency coordinates to OSV; no network isolation or offline scan is
claimed. Nothing from the scanned skill was executed. Scanner installation was temporary
tooling, not installation of the Cloudflare skill or a project dependency.

**Triage.** Preserve all original findings, fingerprints, confidence, and score. The following
manual assessments concern the cited matches only; they are not independent clearance:

| Raw findings | Source evidence at the pinned Cloudflare revision | Disposition |
| --- | --- | --- |
| MP3, 1 HIGH | `AI-AND-LLM.md:29` asks reviewers to examine who may modify memory; it does not direct memory deletion. | Contextual false-positive assessment; not suppressed. |
| PE3, 2 HIGH | `ATTACK-CLASSES.md:118` checks for committed credentials; `DESKTOP-MOBILE-AND-LOCAL-IPC.md:15` recognizes keychain ACLs as controls. | Defensive inspection guidance, not demonstrated credential theft; not suppressed. |
| PE3, 3 HIGH | `validate-coverage-ledger.test.cjs:495`, `validate-findings.test.cjs:320` and `:606` contain unsafe-path rejection inputs. Tests were read, not executed. | Contextual false-positive assessment; not suppressed. |
| EA2, 2 MEDIUM | `SKILL.md:14` says not to automatically run the workflow; `DESKTOP-MOBILE-AND-LOCAL-IPC.md:44` describes missing peer-authentication checks to investigate. | Negation/attack-description matches, not authorization to act; not suppressed. |
| TM3, 1 MEDIUM | `DESKTOP-MOBILE-AND-LOCAL-IPC.md:53` describes world-writable socket paths as a risk. | Defensive guidance, not an unsafe default established here; not suppressed. |
| PE1, 1 LOW | `ATTACK-CLASSES.md:114` asks whether suspicious permission-check comments exist. | Inspection example, not a permission request; not suppressed. |
| AE1, 4 HIGH | References at `SKILL.md:82`, `:174`, and two at `:175` target partially inspected reporting instructions and validators; reasons identify `static_parse_limit` in `static_patterns_tool_misuse`. | Genuine analysis-completeness blockers, not proof of malicious evasion. |

Ten matches have a contextual false-positive assessment; four remain incompleteness blockers.
This does not revise the raw `DO_NOT_INSTALL` recommendation or establish that all skill content
is safe. Adoption, including a documentation-only adaptation, remains blocked pending an
acceptable complete rescan and triage, or the required explicit human waiver.

**Comparison protocol.** Use Producer-Reviewer topology for both arms, with a fresh, source-only
independent verifier per case output. Lock the same producer identity/configuration across arms,
and the same verifier identity/configuration across arms, while preserving the harness's existing
fixed-model and cross-model requirements. Labels such as "critic" do not establish independence.
Record resolved provider/model identities and context separation; do not self-certify them.

Run two paired repetitions of eight cases with fresh contexts: 32 producer calls plus 32 verifier
calls. Alternate arm order by case and reverse it in repetition two. Give both arms identical
source, tools, output schema, and budgets; only the experimental augmentation differs. Hide arm
labels from verifiers, who receive the case, candidate evidence, and refutation task, not the
answer key or the other arm's output. A human adjudicates disagreements against the sealed key.

Count verified expected defects, misses, confirmed false positives on C1/C2, correct U1/U2
abstentions, evidence completeness, and unresolved coverage separately. Deduplicate per case/root
cause, not by finding wording. Record actual wall time, calls, provider token counters, and cost
at a recorded price revision; never estimate unavailable token usage as measured data.

**Evidence boundary.** A pilot finding record contains case/source IDs, fingerprint, attacker,
input, intended invariant, crossed boundary, affected resource, source trace, stated observation,
certainty, verifier identity/disposition, and exact blocker/next validation action when unresolved.
Static contract defects are labeled as such, never as reproduced deployed vulnerabilities.
Coverage units have stable case/surface/boundary IDs and explicit planned, inspected, blocked,
or out-of-scope states. Missing verification is not `confirmed`; malformed records are invalid;
incomplete runs cannot become clean security verdicts. Map only independently supported records
to the current Artifact/Finding/Evidence/Impact/Confidence/Recommended-fix ledger. Keep security
certainty, scanner severity, and harness review priority separate. No adapter is implemented.

| Architectural gate | Decision and evidence |
| --- | --- |
| 1. Domain/module alignment | Design fits existing Understand, Breadth, Depth, and Feedback owners; no new stage. |
| 2. Generality | Evaluate a reusable review technique; fixture modules are examples, not global product assumptions. |
| 3. Ownership | Parent owns manifests/results; reviewers return untrusted records; current gate retains approval authority. |
| 4. Boundary integrity | Experimental evidence is separate from scanner reports and cannot manufacture scanner success or approval. |
| 4b. Isolation/safety | Source-only design; execution remains blocked until a capability-restricted reader/runner and budgets are proved. Full target execution remains excluded. |
| 5. Reuse | Reuse current review contracts, source/test scenarios, findings ledger, and scanner gate; no parallel audit framework. |

These are design decisions, not an independent `APPROVED` architecture verdict. Independent
challenge and human authorization are prerequisites to implementation or comparison execution.

### Constraints

- A trusted runner must expose only immutable packet reads and bounded response submission. Reviewers receive no terminal, process, network, general filesystem, repository-write, or live-service tools. Verify those capability restrictions before invocation; prompt prose alone is insufficient. The runner is not implemented or proved here.
- Proposed total caps: 64 model calls, 60 minutes wall time, 45 seconds per call, and 1,000,000 input-plus-output tokens. Set a per-call input cap of 12,000 tokens and output cap of 2,000 before starting. Reserve all verifier calls and their worst-case token/time allowance before producers; do not spend reserves on retries or extra hunting.
- No paid API quota is authorized by this design. Before a run, the human must approve an explicit monetary ceiling and recorded provider rates; enforce it in addition to the limits above. If exact usage/budget enforcement is unavailable, do not claim cost comparability or start a paid run.
- A limit, missing packet, unverified model identity, tool-capability escape, invalid record, or missing verifier stops the comparison as blocked/incomplete. Preserve attempted outputs and denominators; no silent retries, fixture replacement, or extra scope.
- Full-audit sandbox and descriptor-safe artifact-promotion requirements remain unmet. The upstream findings validator is incompatible with native Node `v24.15.0` on Windows because its required `O_NOFOLLOW` and `O_NONBLOCK` constants are absent. Do not weaken those checks or execute the validators here.
- Preserve Snyk, SonarQube, Lurkr, cross-model reviews, existing security-gate inputs, and human approval gates. A pilot success is not a security-gate pass.

### Validation plan

1. **Current follow-up:** verify report byte hash, parse its JSON, assert static-only provenance and exact finding/component counts, inspect completeness, and preserve the failed-gate status. Check Markdown diagnostics and local memory links. No full project test run is required for these documentation/evidence changes.
2. **Before any comparison:** clear the external-skill gate, independently challenge this Brief, approve execution/cost, materialize and human-check the sealed eight-case corpus, prove immutable reader and deny-all tool restrictions, verify model identities, and dry-check every budget reserve. Do not execute target packets or upstream validators.
3. **Before scoring:** verify the same frozen baseline, case hashes, reviewer configurations, schema, and budgets in both arms. Reject records with missing fields, fabricated verification, unsupported severity, or missing candidate/coverage accounting. Ground-truth evaluation is source-based and human-reviewed.
4. **Decision threshold:** all 32 producer outputs and 32 independent verification records must be present within caps; C1/C2 must have zero confirmed false positives; U1/U2 must not become confirmed vulnerabilities or clean whole-system verdicts; variant detection must not regress on any planted case. Require either at least one additional independently verified planted-defect detection in each repetition or correction of the same baseline unsupported claim in each repetition. Require the variant's measured time and token totals, including its verifiers, to be no more than 125% of the corresponding baseline totals, with all monetary caps met. A perfect baseline with no quality gain does not justify adoption merely because the variant is more verbose.
5. **Disposition:** failed safety gates block; ambiguous or exhausted comparisons stay inconclusive/parked; thresholds met support only a follow-up integration proposal and held-out validation, not automatic adoption. Report this small synthetic evaluation's limited external validity.

### Do NOT

- Install/enable the Cloudflare skill, copy its operating contract into published skills, change model routing, or initiate an audit as a consequence of this Brief.
- Override the raw scanner score, suppress findings to obtain a green result, remove difficult files, bypass Windows safeguards, or invent a scan waiver.
- Execute target-controlled code, access real credentials or endpoints, mutate the live worktree, or let lower-trust records approve themselves.
- Treat format validation, an empty findings list, fresh-agent naming, or a successful scanner process as proof of safe adoption or clean security coverage.

### Assumptions and risks

- `[UNVERIFIED]` An acceptable complete SkillSpector rescan or an authorized waiver can resolve the external-skill gate. Current static analysis is partial, and contextual triage has not been independently approved.
- `[UNVERIFIED]` The proposed packet reader/runner, independent verifier availability, effective model identity, usage receipts, and strict budget enforcement are available. No pilot runner or comparison was executed.
- `[UNVERIFIED]` Independent architecture challenge and human execution/cost approval will accept this design. This author does not supply either approval.
- Synthetic contract mutations exercise evidence and authorization reasoning, not deployment exploitability or broad vulnerability discovery. Reviewer familiarity with public source and planted-case artifacts can bias results; fresh contexts and blinded answer keys reduce, but do not eliminate, that risk.
- Static analysis cannot settle missing identity, deployment, provider, operating-system, or runtime behavior. Keep those facts unresolved rather than converting them into stronger claims.
- The retained raw report contains public upstream excerpts and a local staging path, not target audit secrets. Scanner parsing limits and a high aggregate score must be disclosed without claiming the skill is malicious.
