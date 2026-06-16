# Legal & Compliance — Stage Machine

The same six-stage contract as the software harness, relabeled for legal and compliance work. Every
non-trivial instrument (a new agreement, an amendment, a compliance memo) moves through these stages;
a one-line clause correction may start at Draft.

| #   | Stage          | Purpose                                                                                       | Mandatory output                                  |
| --- | -------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 0   | Frame          | Define the matter, parties, objective, and governing jurisdiction (and venue).                | Matter note                                       |
| 1   | Structure      | Lay out clause architecture, allocate risk, and fix defined terms *before* operative drafting.| Structure brief clearing gates 1–5                |
| 2   | Draft          | Write the instrument: clauses, defined terms, obligations — each clear, bounded, traceable.   | Draft instrument + self-review checklist          |
| 3   | Review breadth | Scan every clause for completeness and internal consistency.                                  | Severity-tagged findings                          |
| 4   | Review depth   | Issue a verdict on each of the five gates.                                                    | Gate verdicts + structural findings               |
| 5   | Feedback       | Evaluate challenges, reconcile the risk allocation, finalize the instrument.                  | Verdict table + final instrument                  |

## Stage contract

1. **Memory before discovery.** Consult prior briefs/lessons in `.github/harness/memory/` for the
   counterparty, matter type, or governing jurisdiction before re-deriving clause language or risk
   allocations.
2. **Context sufficiency first.** Inventory the governing law, the parties' positions, and the
   regulatory regime you have; name what is missing before drafting. Never assert an authority you
   cannot cite.
3. **Carry the structure brief forward.** The brief from stage 1 is the input to Draft, Review depth,
   and Feedback. Persist it to `.github/harness/memory/briefs/`.
4. **Honor the gates** (stages 1 and 4): Jurisdiction Alignment, Defined-Term Consistency,
   Enforceability, Obligation Completeness, Authority Traceability. See [`gates.md`](./gates.md).
5. **Close with status.** End with the deterministic check status (`legal-validate`) and residual
   legal risk.

## Deterministic gate before sign-off

Before an instrument is reviewed by a human, `node scripts/harness/domain-pack.mjs check
legal-compliance --deliverable <instrument>` must be green: required sections present, every defined
term used, every authority citation resolves. These are necessary, not sufficient — they catch the
mechanical defects so the human review can spend its attention on judgment.
