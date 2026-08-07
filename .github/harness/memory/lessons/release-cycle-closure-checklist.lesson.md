---
summary: "Lesson: Release Cycle Closure Checklist"
type: lesson
status: promoted
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [release-process, validation, closure-evidence, operator-checklist, versioning]
---
# Lesson: Release Cycle Closure Checklist

**tags**: release-process, validation, closure-evidence, operator-checklist, versioning

## Context

After completing a release (e.g., v2.5.0), it's important to verify all steps were completed and document closure evidence. This lesson provides a structured checklist and template for capturing what was done, what was deferred, and what validation was performed.

## Release Closure Checklist Template

### Phase 1: Pre-Release Validation

- [ ] **Version Bump**: Updated version in all surfaces
  - Package.json, package-lock.json, etc.
  - Command to verify: `npm run harness:version:check`
  
- [ ] **Docs Contract**: Verified documentation is complete and consistent
  - README updated with new features / changes
  - SETUP.md reflects new workflow steps
  - Command to verify: `npm run harness:docs:check`
  
- [ ] **Release Notes**: Created or updated release notes file
  - File: `RELEASE_NOTES_v<version>.md`
  - Contains: summary, what's new, validation results, known issues
  
- [ ] **Health Checks**: Fast health checks passing
  - Command: `npm run harness:health -- --fast`
  - Expected: All critical surfaces report OK

### Phase 2: Git Operations

- [ ] **Commit**: All changes committed to main branch
  - Message format: "chore(release): v<version> - <description>"
  - Command: `git log -1 --oneline`
  - Evidence: Commit hash + message
  
- [ ] **Push**: Commit pushed to origin/main
  - Command: `git log origin/main..` (should be empty)
  - Evidence: Commit appears in GitHub history
  
- [ ] **Tag**: Release tag created and pushed
  - Command: `git tag -l v<version>`
  - Evidence: Tag exists in local and origin
  - Verify: Tag points to correct commit

### Phase 3: Release Entry Creation

- [ ] **GitHub Release**: Entry created via GitHub API (or manual UI)
  - Method: Automated (scripts/create-release.ps1) OR manual (GitHub web UI)
  - **Blocking Issue**: Requires GITHUB_TOKEN environment variable
  - **Workaround**: If token unavailable, manually create via https://github.com/<owner>/<repo>/releases/new
  - **Status Classification**: 
    - ✅ Blocked and resolved: token set, release created
    - ⏳ Blocked and deferred: token missing, manual alternative provided
  - Evidence: Release URL or screenshot
  
- [ ] **Release Content**: GitHub Release includes
  - Tag name: v<version>
  - Release title: Descriptive title
  - Release body: Markdown with features, validation results, links
  - Draft flag: false (publicly visible)
  - Prerelease flag: false (unless this is a pre-release)

### Phase 4: Closure Documentation

- [ ] **Closure Record**: Created a feedback verdict or closure brief
  - File: `.github/harness/memory/briefs/feedback-verdict-<date>-<brief>.md`
  - Contains: Point-by-point verdicts, accepted changes, deferred items, brief updates
  
- [ ] **Issue Remediation**: Addressed any open findings from prior work
  - Cross-reference: Earlier briefs or review records
  - Evidence: Validation commands and output
  
- [ ] **Known Deferred**: Explicitly documented any deferred work
  - Why deferred: External blocker (e.g., missing GITHUB_TOKEN)
  - When to resume: Next release or when blocker resolved
  - Dependency: What else must happen first

### Phase 5: Operator Communication

- [ ] **Release Notes Visibility**: Users can easily find release info
  - RELEASE_NOTES_v<version>.md is discoverable
  - GitHub Release page has clear title and body
  - Linked from README or CHANGELOG (if applicable)
  
- [ ] **Upgrade Guide**: Documented any breaking changes or migration steps
  - How to upgrade from previous version
  - Any new dependencies or configuration required
  
- [ ] **Support Channels**: Created or updated help documentation
  - Known issues documented
  - Workarounds provided where applicable

## Closure Evidence Recording Template

Use this template to capture evidence for each release phase:

```markdown
# Release v<VERSION> Closure Evidence

## Metadata
- Release Date: <DATE>
- Version Bump: v<OLD> → v<NEW>
- Commit Hash: <HASH>
- Tag: v<VERSION>

## Phase 1: Pre-Release Validation
- Version Bump: ✅ Verified via `npm run harness:version:check`
  - Files updated: package.json, package-lock.json
- Docs Contract: ✅ Passed `npm run harness:docs:check`
- Release Notes: ✅ Created RELEASE_NOTES_v<VERSION>.md
- Health Checks: ✅ `npm run harness:health -- --fast` passed

## Phase 2: Git Operations
- Commit: ✅ Committed with message "chore(release): v<VERSION> - <description>"
  - Commit: <HASH>
  - Output: `git log -1 --oneline`
- Push: ✅ Pushed to origin/main
  - Verified: No commits ahead of origin
- Tag: ✅ Tag v<VERSION> created and pushed
  - Command: `git tag -v v<VERSION>`
  - Points to: <COMMIT_HASH>

## Phase 3: Release Entry Creation
- GitHub Release: ⏳ DEFERRED (GITHUB_TOKEN not available)
  - Issue: `GITHUB_TOKEN` environment variable not set
  - Manual Alternative: https://github.com/<OWNER>/<REPO>/releases/new?tag=v<VERSION>
  - Will Resume: When deploying via GitHub Actions or token becomes available
  - Impact: Tag exists, release notes drafted; GitHub Release entry pending

## Phase 4: Closure Documentation
- Closure Record: ✅ Created feedback verdict
  - File: `.github/harness/memory/briefs/feedback-verdict-<DATE>-<BRIEF>.md`
  - Status: All remediations completed
- Issue Remediation: ✅ Graph freshness and memory-link index verified
  - Commands run: `npm run harness:graph status`, `npm run harness:memory:links -- status`
  - Results: Both fresh/healthy
- Known Deferred: ⏳ GitHub Release publishing
  - Documented: In feedback-verdict and release-notes

## Phase 5: Operator Communication
- Release Notes Visibility: ✅ RELEASE_NOTES_v<VERSION>.md created
  - Location: Project root, linked from README
- Upgrade Guide: ✅ Documented in SETUP.md
- Support Channels: ✅ Known issues captured in release notes

## Sign-Off
- Release Cycle: ✅ CLOSED (with deferred item: GitHub Release)
- Operator: <NAME>
- Date: <DATE>
- Next Steps: GitHub Release to be published when GITHUB_TOKEN available
```

## Real Example: v2.5.0 Release (2026-07-28)

See [Feedback Verdict Record - Docs/Setup Usability + v2.5.0 Release](../reviews/feedback-verdict-2026-07-28-docs-setup-release-v2-5-0.md) for the complete closure evidence from v2.5.0.

**Summary**:
- ✅ Docs/Setup improvements completed
- ✅ Version bumped to 2.5.0
- ✅ Commit pushed, tag created
- ⏳ GitHub Release entry deferred (GITHUB_TOKEN unavailable)

## Guidelines

1. **Complete before moving to next release**: Close out deferred items or explicitly mark for future work
2. **Document blockers explicitly**: Don't hide credential issues; make them discoverable
3. **Capture timestamps**: When was each phase completed? This helps with audit trails
4. **Link to briefs**: Cross-reference to architecture briefs, review records, and feedback verdicts
5. **Provide workarounds**: If a step is blocked, always provide a manual alternative path
6. **Sign-off**: Who validated closure? This creates accountability

## Common Patterns

### Partial Delivery (Deferred but Acceptable)
- Tag exists + release notes ready, but GitHub Release entry pending credential
- Strategy: Document deferred item; schedule for next release or CI/CD integration
- Evidence: Closure record explicitly lists deferred item with reason

### Blocked Releases
- A critical blocker prevents ANY forward progress
- Strategy: Fail fast; provide clear guidance for resolution
- Operator action: Address blocker before reattempting release

### Quick Patches (Hotfix)
- Minimal scope release (e.g., docs fix, patch in one file)
- Strategy: Skip phases that don't apply; document scope clearly
- Evidence: Still capture closure record with minimal scope note

## See Also

- [Credential Deferral and Environment Constraints](#)
- [Auto-Heal Readiness Workflows](#)
- [v2.5.0 Feedback Verdict](../reviews/feedback-verdict-2026-07-28-docs-setup-release-v2-5-0.md)
