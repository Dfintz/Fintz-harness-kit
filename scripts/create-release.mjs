#!/usr/bin/env node
/**
 * Create GitHub Release for v2.2.1
 * Uses GitHub API to create release from existing tag
 */

import { execSync } from 'node:child_process';
import fetch from 'node-fetch';

const REPO_OWNER = 'Dfintz';
const REPO_NAME = 'Fintz-harness-kit';
const TAG = 'v2.2.1';
const RELEASE_TITLE = 'v2.2.1 - Phase 5c Validation & Monitoring Suite';
const RELEASE_BODY = `## Phase 5c Validation & Monitoring Suite

### What's New
- ✅ **Phase 5c Cascade Health Check** - Comprehensive 120-run validation confirming +3.4% quality improvement
- ✅ **Live Monitoring Dashboard** - Real-time performance tracking for all 20 skills with tier-based grouping
- ✅ **Regression Alerting** - Automatic alerts when any skill quality drops >5%
- ✅ **Documentation Sync** - Updated llms.txt with Phase 5c model assignments
- ✅ **Complete Deployment Summary** - Full documentation of Phase 5c workflow and sign-off

### Validation Results
| Metric | Result |
|--------|--------|
| **Success Rate** | 100% ✅ |
| **Avg Quality** | 0.817 (+3.4% vs Phase 5b) ✅ |
| **Cascade Health** | HEALTHY ✅ |
| **Regressions** | 0 ✅ |
| **Production Ready** | YES ✅ |

### Key Components
- \`scripts/harness/phase5c-cascade-health-check.mjs\` - Validation engine
- \`scripts/harness/phase5c-live-monitor.mjs\` - Live dashboard
- \`harness.config.json\` - Phase 5c model routing (11 upgrades)
- \`llms.txt\` - Updated model discovery metadata
- \`npm run harness:phase5c:monitor\` - Start live monitoring
- \`npm run harness:phase5c:cascade-health\` - Run validation

### Release History
- v2.0.0 - Phase 5 GA (120/120 success, +12-19% quality)
- v2.1.0 - Project adoption template + consistency fixes
- v2.2.0 - Phase 5 Multi-Model Optimizer (360 runs, +3.5% quality)
- **v2.2.1 - Phase 5c Validation & Monitoring Suite** ← Current

### Next Steps
1. Run live monitoring: \`npm run harness:phase5c:monitor\`
2. Weekly performance review
3. Monthly model re-evaluation
4. Quarterly optimization cycle

---

**Status**: 🟢 Production-Ready | **Validated**: 2026-07-25`;

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
