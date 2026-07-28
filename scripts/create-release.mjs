#!/usr/bin/env node
/**
 * Create GitHub Release for v2.5.0
 * Uses GitHub API to create release from existing tag
 */

import { execSync } from 'node:child_process';
import fetch from 'node-fetch';

const REPO_OWNER = 'Dfintz';
const REPO_NAME = 'Fintz-harness-kit';
const TAG = process.env.HARNESS_RELEASE_TAG || 'v2.5.0';
const RELEASE_TITLE = process.env.HARNESS_RELEASE_TITLE || 'v2.5.0 - Docs & Setup Usability Refresh';
const RELEASE_BODY = `## Docs & Setup Usability Refresh

### What's New
- ✅ **Install commands made concrete** - README now uses direct install targets for faster first use
- ✅ **Fast onboarding checklists** - Added short, ordered setup flow in README and SETUP
- ✅ **Maintainer release checklist** - Added explicit release flow to reduce tag/version drift
- ✅ **Version coherence update** - Internal package/lockfile version surfaces aligned to 2.5.0
- ✅ **Historical command normalization** - Legacy memory artifacts now use a single canonical graph command form

### Validation Summary
| Metric | Result |
|--------|--------|
| **Docs Contract Check** | PASS ✅ |
| **Fast Health Check** | PASS ✅ |
| **Release Version** | v2.5.0 ✅ |
| **Tag Target** | above v2.4.0 ✅ |
| **Release Ready** | YES ✅ |

### Key Components
- \`README.md\` - usability and first-run updates
- \`SETUP.md\` - onboarding and maintainer release checklist
- \`package.json\` - version bump to 2.5.0
- \`package-lock.json\` - aligned root package version
- \`RELEASE_NOTES_v2.5.0.md\` - release notes source

### Release History
- v2.0.0 - Phase 5 GA (120/120 success, +12-19% quality)
- v2.1.0 - Project adoption template + consistency fixes
- v2.2.0 - Phase 5 Multi-Model Optimizer (360 runs, +3.5% quality)
- v2.3.0 - Phase 5c real measurement and Copilot integration
- v2.4.0 - Prior stable release
- **v2.5.0 - Docs & Setup Usability Refresh** ← Current

### Next Steps
1. Follow the new README first-run checklist
2. Use SETUP release checklist for the next version cut
3. Keep version/tag/release-note surfaces in sync each release
4. Re-run `harness:docs:check` before every tag

---

**Status**: 🟢 Release-Ready | **Validated**: 2026-07-28`;

// Get GitHub token from git config
let token = null;
try {
  token = execSync('git config --global github.token', { encoding: 'utf8' }).trim();
} catch (e) {
  console.log('No git config token found, trying environment variable...');
  token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
}

if (!token) {
  console.error('❌ GitHub token not found. Please set GITHUB_TOKEN environment variable or use "git config --global github.token <token>"');
  process.exit(1);
}

const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`;

const releaseData = {
  tag_name: TAG,
  name: RELEASE_TITLE,
  body: RELEASE_BODY,
  draft: false,
  prerelease: false,
  generate_release_notes: false
};

console.log(`📦 Creating GitHub Release: ${TAG}`);
console.log(`   Owner: ${REPO_OWNER}`);
console.log(`   Repo: ${REPO_NAME}`);
console.log(`   Title: ${RELEASE_TITLE}\n`);

fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(releaseData)
})
  .then(res => {
    if (!res.ok) {
      return res.json().then(err => {
        throw new Error(`API Error (${res.status}): ${err.message}`);
      });
    }
    return res.json();
  })
  .then(release => {
    console.log(`✅ Release created successfully!`);
    console.log(`   URL: ${release.html_url}`);
    console.log(`   ID: ${release.id}`);
    console.log(`   Published: ${release.published_at}`);
  })
  .catch(err => {
    console.error(`❌ Failed to create release: ${err.message}`);
    process.exit(1);
  });
