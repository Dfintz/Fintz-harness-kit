# Teach-Agent Lifecycle

This lifecycle governs how guidance moves from idea to production-ready, machine-operational skill
content.

## States

1. **candidate**: Draft guidance captured with initial provenance.
2. **reviewed**: Gates checked, contradictions assessed, and trust rationale documented.
3. **adopted**: Approved for active use in skills, prompts, or harness docs.
4. **rejected**: Not suitable; keep rationale so it does not re-enter unchanged.
5. **stale**: Previously adopted content that now needs revalidation.

## Promotion Rules

Move to **adopted** only when all gates pass:

- provenance: concrete source and resource path
- trust: source quality rationale
- contradiction: no unresolved conflicts with active briefs
- freshness: review timestamp and recheck cadence
- operational: executable steps plus clear success criteria

## Ownership

- Reviewer validates evidence quality and contradiction checks.
- Harness maintainer approves adoption into active skills/instructions.
- Any session that detects drift marks affected entries as **stale**.
