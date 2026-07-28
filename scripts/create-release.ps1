#!/usr/bin/env pwsh
# Create GitHub Release for v2.5.0 using GitHub API
#
# Prerequisites: GITHUB_TOKEN environment variable or git credential

$owner = "Dfintz"
$repo = "Fintz-harness-kit"
$tag = if ($env:HARNESS_RELEASE_TAG) { $env:HARNESS_RELEASE_TAG } else { "v2.5.0" }
$title = if ($env:HARNESS_RELEASE_TITLE) { $env:HARNESS_RELEASE_TITLE } else { "v2.5.0 - Docs & Setup Usability Refresh" }
$body = @"
## Docs & Setup Usability Refresh

### What's New
- ✅ **Install commands made concrete** in README
- ✅ **Fast onboarding checklists** in README and SETUP
- ✅ **Maintainer release checklist** added to SETUP
- ✅ **Internal versioning updated** to 2.5.0
- ✅ **Historical command normalization** completed in memory artifacts

### Validation Summary
| Metric | Result |
|--------|--------|
| **Docs Contract Check** | PASS ✅ |
| **Fast Health Check** | PASS ✅ |
| **Release Version** | v2.5.0 ✅ |
| **Tag Target** | above v2.4.0 ✅ |
| **Release Ready** | YES ✅ |

### Key Components
- `README.md` - usability and first-run updates
- `SETUP.md` - onboarding and maintainer release checklist
- `package.json` - version bump to 2.5.0
- `package-lock.json` - aligned root package version
- `RELEASE_NOTES_v2.5.0.md` - release notes source

### Getting Started
\`\`\`bash
npm run harness:health -- --fast
npm run harness:docs:check
\`\`\`

### Release History
- v2.0.0 - Phase 5 GA
- v2.1.0 - Project adoption template
- v2.2.0 - Phase 5 Multi-Model Optimizer
- v2.3.0 - Phase 5c real measurement and Copilot integration
- v2.4.0 - Prior stable release
- **v2.5.0 - Docs & Setup Usability Refresh** ← Current

**Status**: 🟢 Release-Ready | **Validated**: 2026-07-28
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
