---
name: teach-agent
description: Convert repository domain knowledge into machine-operational guidance for agents. Use when curating lessons, authoring skill docs, or gating knowledge promotion.
---

# Skill: Teach Agent

> Use when: You need to convert repository domain knowledge into machine-operational guidance that
> helps agents execute tasks correctly.

## Objective

Create and maintain machine-first guidance that is:

- executable by agents with minimal ambiguity
- traceable to trusted repository or external sources
- promotion-gated so only validated guidance is adopted
- measurable through agent-centric evaluation tasks

## Inputs

Read these surfaces first:

1. .github/harness/memory/README.md
2. .github/harness/memory/briefs/README.md
3. .github/harness/memory/curation/teach-agent-lifecycle.md
4. Relevant active briefs in .github/harness/memory/briefs/

## Machine-First Contract

Guidance produced by this skill must prioritize agent execution over human narrative.

Required characteristics:

- action-oriented steps with explicit prerequisites
- stable identifiers for files, commands, and decision states
- unambiguous acceptance criteria and failure handling
- provenance references for every non-trivial claim

Avoid:

- prose-heavy tutorials without executable checkpoints
- aesthetic-only formatting requirements
- recommendations that cannot be validated in this repository

## Lifecycle States

Use the lifecycle in .github/harness/memory/curation/teach-agent-lifecycle.md:

- candidate
- reviewed
- adopted
- rejected
- stale

## Promotion Gates

A candidate can move to adopted only when all gates pass:

1. Provenance gate: source and resource path are present and specific.
2. Trust gate: source quality rationale is recorded.
3. Contradiction gate: no unresolved conflicts with active briefs.
4. Freshness gate: review timestamp is recent and revalidation cadence is set.
5. Operational gate: guidance includes executable steps and success criteria.

## Workflow

1. Ingest candidate knowledge from internal memory surfaces and external standards.
2. Normalize into machine-operational form.
3. Run lifecycle promotion gates.
4. Persist adopted guidance with provenance metadata.
5. Validate via the teach-agent eval set.

## Evaluation Expectations

Use .github/harness/eval-sets/teach-agent.json to measure:

- retrieval precision for executable guidance
- contradiction rate versus active briefs
- stale guidance rate
- execution-success correlation from traced tasks

## Exit Checklist

Before closing a teach-agent run:

- Every touched artifact has an explicit lifecycle state.
- Adopted items include provenance and trust rationale.
- Contradiction checks against active briefs are recorded.
- Eval set criteria are addressed or explicitly deferred.

## Usage Scenarios

### Scenario 1: Convert brief learnings into machine-operational rules

What this demonstrates: Promoting architecture decisions into agent-ready execution guidance.

### Scenario 2: Triage external standards for agent adoption

What this demonstrates: Candidate intake, trust checks, contradiction checks, and gated promotion.
