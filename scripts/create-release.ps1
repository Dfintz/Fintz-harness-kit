#!/usr/bin/env pwsh
# Create GitHub Release for v2.2.1 using GitHub API
#
# Prerequisites: GITHUB_TOKEN environment variable or git credential

$owner = "Dfintz"
$repo = "Fintz-harness-kit"
$tag = "v2.2.1"
$title = "v2.2.1 - Phase 5c Validation & Monitoring Suite"
$body = @"
## Phase 5c Validation & Monitoring Suite

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
- `scripts/harness/phase5c-cascade-health-check.mjs` - Validation engine
- `scripts/harness/phase5c-live-monitor.mjs` - Live dashboard
- `harness.config.json` - Phase 5c model routing (11 upgrades)
- `llms.txt` - Updated model discovery metadata

### Getting Started
\`\`\`bash
npm run harness:phase5c:monitor       # Start live monitoring
npm run harness:phase5c:cascade-health # Run validation
\`\`\`

### Release History
- v2.0.0 - Phase 5 GA
- v2.1.0 - Project adoption template
- v2.2.0 - Phase 5 Multi-Model Optimizer
- **v2.2.1 - Phase 5c Validation & Monitoring Suite** ← Current

**Status**: 🟢 Production-Ready | **Validated**: 2026-07-25
"@

$token = $env:GITHUB_TOKEN
if (-not $token) {
    Write-Host "❌ GITHUB_TOKEN environment variable not set"
    Write-Host ""
    Write-Host "Please set your GitHub token:"
    Write-Host '  $env:GITHUB_TOKEN = "<your-token>"'
    Write-Host ""
    Write-Host "Or visit: https://github.com/$owner/$repo/releases/new?tag=$tag"
    exit 1
}

$url = "https://api.github.com/repos/$owner/$repo/releases"
$headers = @{
    "Authorization" = "token $token"
    "Accept" = "application/vnd.github.v3+json"
    "Content-Type" = "application/json"
}

$payload = @{
    tag_name = $tag
    name = $title
    body = $body
    draft = $false
    prerelease = $false
} | ConvertTo-Json

Write-Host "📦 Creating GitHub Release: $tag"
Write-Host "   Owner: $owner"
Write-Host "   Repo: $repo"
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $url -Method Post -Headers $headers -Body $payload
    $release = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Release created successfully!"
    Write-Host "   URL: $($release.html_url)"
    Write-Host "   ID: $($release.id)"
    Write-Host "   Published: $($release.published_at)"
}
catch {
    $errorResponse = $_.Exception.Response
    if ($errorResponse) {
        $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
        $error_content = $reader.ReadToEnd()
        Write-Host "❌ Failed to create release (HTTP $($errorResponse.StatusCode))"
        Write-Host "Error: $error_content"
    }
    else {
        Write-Host "❌ Error: $($_.Exception.Message)"
    }
    exit 1
}
