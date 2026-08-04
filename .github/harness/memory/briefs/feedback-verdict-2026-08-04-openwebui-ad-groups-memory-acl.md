---
artifact_family: review
immutability: mutable
status: implemented
---

# Feedback Verdict: openwebui-active-directory-groups-memory-acl-2026-08-04
resource: .github/harness/memory/briefs/openwebui-active-directory-groups-memory-acl-2026-08-04.md,.github/harness/memory/reviews/review-breadth-findings-2026-08-04-openwebui-ad-groups-memory-acl.md,.github/harness/memory/reviews/review-depth-findings-2026-08-04-openwebui-ad-groups-memory-acl.md,scripts/harness/test/mcp-http-memory-acl-ad-groups-test.mjs

## Verdict
ACCEPTED

## Verdict Table
| Challenge | Decision | Evidence | Outcome |
| --- | --- | --- | --- |
| Implement via Open WebUI-compatible path | Upheld | ACL enforcement added in scripts/harness/http-adapter.mjs for memory tools | Implemented |
| Use Active Directory security groups for access control | Upheld | x-ms-groups default mapping and teams normalization; AD groups test pass | Implemented |
| Keep backward compatibility and safety posture | Current decision holds | Policy remains opt-in via enabled flag; denied reads are non-disclosing | Preserved |

## Brief Update Note
- Principal matching semantics were clarified to allow role OR caller OR team selector matches, enabling AD group-based authorization without requiring role match.
