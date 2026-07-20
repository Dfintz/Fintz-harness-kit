$ErrorActionPreference = 'SilentlyContinue'
Set-Location "C:\Users\Fintz\OneDrive\Documents\GitHub\sc-fleet-manager\frontend\src"

$files = Get-ChildItem -Recurse -Filter *.tsx | Where-Object {
    $_.Name -notmatch '\.test\.tsx$' -and
    $_.Name -notmatch '\.spec\.tsx$' -and
    $_.Name -notmatch '\.stories\.tsx$' -and
    $_.FullName -notmatch '\\__tests__\\' -and
    $_.FullName -notmatch 'node_modules' -and
    $_.FullName -notmatch '\\components\\ui\\'
}

$fixCount = 0

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    $fname = $f.FullName.Replace('C:\Users\Fintz\OneDrive\Documents\GitHub\sc-fleet-manager\frontend\src\', '')
    
    # Check MUI
    $needMui = @()
    if ($content -match '<Box[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bBox\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'Box' }
    if ($content -match '<Stack[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bStack\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'Stack' }
    if ($content -match '<Typography[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bTypography\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'Typography' }
    if ($content -match '<CircularProgress[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bCircularProgress\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'CircularProgress' }
    if ($content -match '<Tabs[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bTabs\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'Tabs' }
    
    # Check UI
    $needUi = @()
    if ($content -match '<Button[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s+.@mui/material' -and $content -notmatch '(?s)import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s+.@/components/ui' -and $content -notmatch '(?s)import\s+Button\s+from\s+.@/components/ui') { $needUi += 'Button' }
    if ($content -match '<Select[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bSelect\b[^}]*\}\s*from\s+.@mui/material' -and $content -notmatch '(?s)import\s*\{[^}]*\bSelect\b[^}]*\}\s*from\s+.@/components/ui' -and $content -notmatch '(?s)import\s+Select\s+from\s+.@/components/ui') { $needUi += 'Select' }
    if ($content -match '<Checkbox[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bCheckbox\b[^}]*\}\s*from\s+.@mui/material' -and $content -notmatch '(?s)import\s*\{[^}]*\bCheckbox\b[^}]*\}\s*from\s+.@/components/ui' -and $content -notmatch '(?s)import\s+Checkbox\s+from\s+.@/components/ui') { $needUi += 'Checkbox' }
    
    # Check Spectrum compat
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
    
    $fixCount++
    Write-Output "NEED_FIX: $fname"
    if ($needMui.Count -gt 0) { Write-Output "  MUI: $($needMui -join ', ')" }
    if ($needUi.Count -gt 0) { Write-Output "  UI: $($needUi -join ', ')" }
    if ($needCompat.Count -gt 0) { Write-Output "  COMPAT: $($needCompat -join ', ')" }
}

Write-Output ""
Write-Output "Total files needing fix: $fixCount"
