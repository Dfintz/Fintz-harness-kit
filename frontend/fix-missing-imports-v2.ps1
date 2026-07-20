$ErrorActionPreference = 'SilentlyContinue'
$basePath = "C:\Users\Fintz\OneDrive\Documents\GitHub\sc-fleet-manager\frontend\src"
Set-Location $basePath

$files = Get-ChildItem -Recurse -Filter *.tsx | Where-Object {
    $_.Name -notmatch '\.test\.tsx$' -and
    $_.Name -notmatch '\.spec\.tsx$' -and
    $_.Name -notmatch '\.stories\.tsx$' -and
    $_.FullName -notmatch '\\__tests__\\' -and
    $_.FullName -notmatch 'node_modules' -and
    $_.FullName -notmatch '\\components\\ui\\'
}

$fixCount = 0
$totalAdded = 0

foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText($f.FullName)
    $fname = $f.FullName.Replace("$basePath\", '')
    $modified = $false
    
    # --- Detect needed MUI components ---
    $needMui = @()
    if ($content -match '<Box[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bBox\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'Box' }
    if ($content -match '<Stack[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bStack\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'Stack' }
    if ($content -match '<Typography[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bTypography\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'Typography' }
    if ($content -match '<CircularProgress[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bCircularProgress\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'CircularProgress' }
    if ($content -match '<Tabs[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bTabs\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'Tabs' }
    if ($content -match '<Tab[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bTab\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'Tab' }
    
    # --- Detect needed UI components ---
    $needUi = @()
    if ($content -match '<Button[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s+.@mui/material' -and $content -notmatch '(?s)import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s+.@/components/ui' -and $content -notmatch '(?s)import\s+Button\s+from\s+.@/components/ui') { $needUi += 'Button' }
    if ($content -match '<Select[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bSelect\b[^}]*\}\s*from\s+.@mui/material' -and $content -notmatch '(?s)import\s*\{[^}]*\bSelect\b[^}]*\}\s*from\s+.@/components/ui' -and $content -notmatch '(?s)import\s+Select\s+from\s+.@/components/ui') { $needUi += 'Select' }
    if ($content -match '<Checkbox[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bCheckbox\b[^}]*\}\s*from\s+.@mui/material' -and $content -notmatch '(?s)import\s*\{[^}]*\bCheckbox\b[^}]*\}\s*from\s+.@/components/ui' -and $content -notmatch '(?s)import\s+Checkbox\s+from\s+.@/components/ui') { $needUi += 'Checkbox' }
    
    # --- Detect needed Spectrum compat components ---
    $needCompat = @()
    if ($content -match '<DialogContainer[\s>/]' -and $content -notmatch '(?s)import[^;]*\bDialogContainer\b[^;]*from') { $needCompat += 'DialogContainer' }
    if ($content -match '<DialogTrigger[\s>/]' -and $content -notmatch '(?s)import[^;]*\bDialogTrigger\b[^;]*from') { $needCompat += 'DialogTrigger' }
    if ($content -match '<ProgressCircle[\s>/]' -and $content -notmatch '(?s)import[^;]*\bProgressCircle\b[^;]*from') { $needCompat += 'ProgressCircle' }
    if ($content -match '<Content[\s>/]' -and $content -notmatch '(?s)import[^;]*\bContent\b[^;]*from') { $needCompat += 'Content' }
    if ($content -match '<TypographyField[\s>/]' -and $content -notmatch '(?s)import[^;]*\bTypographyField\b[^;]*from') { $needCompat += 'TypographyField' }
    if ($content -match '<TypographyArea[\s>/]' -and $content -notmatch '(?s)import[^;]*\bTypographyArea\b[^;]*from') { $needCompat += 'TypographyArea' }
    if ($content -match '<ButtonGroup[\s>/]' -and $content -notmatch '(?s)import[^;]*\bButtonGroup\b[^;]*from') { $needCompat += 'ButtonGroup' }
    if ($content -match '<TabList[\s>/]' -and $content -notmatch '(?s)import[^;]*\bTabList\b[^;]*from') { $needCompat += 'TabList' }
    if ($content -match '<TabPanels[\s>/]' -and $content -notmatch '(?s)import[^;]*\bTabPanels\b[^;]*from') { $needCompat += 'TabPanels' }
    if ($content -match '<Well[\s>/]' -and $content -notmatch '(?s)import[^;]*\bWell\b[^;]*from') { $needCompat += 'Well' }
    
    if ($needMui.Count -eq 0 -and $needUi.Count -eq 0 -and $needCompat.Count -eq 0) { continue }
    
    # --- Strategy: Add NEW import lines ONLY (don't modify existing imports) ---
    # This avoids the multi-line import corruption issue.
    # Files that already import from @mui/material or @/components/ui get a SECOND import line.
    # TypeScript/bundlers handle multiple import lines from the same module just fine.
    
    $newLines = @()
    if ($needMui.Count -gt 0) {
        $newLines += "import { $($needMui -join ', ') } from '@mui/material';"
    }
    if ($needUi.Count -gt 0) {
        $newLines += "import { $($needUi -join ', ') } from '@/components/ui';"
    }
    if ($needCompat.Count -gt 0) {
        $newLines += "import { $($needCompat -join ', ') } from '@/components/ui';"
    }
    
    if ($newLines.Count -eq 0) { continue }
    
    # Find the position of the last import statement to insert after it
    # Use regex to find the last 'from' in an import statement
    $importMatches = [regex]::Matches($content, "(?m)^import\s+.*?from\s+['""][^'""]+['""];?\s*$")
    # Also match multi-line imports ending with from '...';\n
    $multiImportMatches = [regex]::Matches($content, "(?s)import\s*\{[^}]+\}\s*from\s+['""][^'""]+['""];?")
    
    $lastPos = 0
    foreach ($m in $importMatches) {
        $endPos = $m.Index + $m.Length
        if ($endPos -gt $lastPos) { $lastPos = $endPos }
    }
    foreach ($m in $multiImportMatches) {
        $endPos = $m.Index + $m.Length
        if ($endPos -gt $lastPos) { $lastPos = $endPos }
    }
    
    if ($lastPos -gt 0) {
        # Find the next newline after lastPos
        $nlPos = $content.IndexOf("`n", $lastPos)
        if ($nlPos -lt 0) { $nlPos = $lastPos }
        
        $insertText = "`n" + ($newLines -join "`n")
        $content = $content.Insert($nlPos, $insertText)
        $modified = $true
    } else {
        # No imports found, add at top
        $insertText = ($newLines -join "`n") + "`n"
        $content = $insertText + $content
        $modified = $true
    }
    
    if ($modified) {
        [System.IO.File]::WriteAllText($f.FullName, $content)
        $fixCount++
        $added = $needMui.Count + $needUi.Count + $needCompat.Count
        $totalAdded += $added
        Write-Output "FIXED: $fname (+$added imports)"
        if ($needMui.Count -gt 0) { Write-Output "  MUI: $($needMui -join ', ')" }
        if ($needUi.Count -gt 0) { Write-Output "  UI: $($needUi -join ', ')" }
        if ($needCompat.Count -gt 0) { Write-Output "  COMPAT: $($needCompat -join ', ')" }
    }
}

Write-Output ""
Write-Output "Fixed $fixCount files, added $totalAdded imports total"
