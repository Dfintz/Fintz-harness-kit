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
    
    # --- MUI components ---
    $needMui = @()
    if ($content -match '<Badge[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bBadge\b[^}]*\}\s*from\s+.@mui/material' -and $content -notmatch '(?s)import\s*\{[^}]*\bBadge\b[^}]*\}\s*from\s+.@/components/ui') { $needMui += 'Badge' }
    if ($content -match '<Dialog[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bDialog\b[^}]*\}\s*from\s+.@mui/material' -and $content -notmatch '(?s)import\s*\{[^}]*\bDialog\b[^}]*\}\s*from\s+.@/components/ui') { $needMui += 'Dialog' }
    
    # --- UI components (from @/components/ui) ---
    $needUi = @()
    # Case-sensitive check using [regex] to avoid matching lowercase html tags
    $grids = [regex]::Matches($content, '<Grid[\s>/]')
    if ($grids.Count -gt 0 -and $content -notmatch '(?s)import\s*\{[^}]*\bGrid\b[^}]*\}\s*from\s+.@mui/material' -and $content -notmatch '(?s)import\s*\{[^}]*\bGrid\b[^}]*\}\s*from\s+.@/components/ui') { $needUi += 'Grid' }
    $items = [regex]::Matches($content, '<Item[\s>/]')
    if ($items.Count -gt 0 -and $content -notmatch '(?s)import\s*\{[^}]*\bItem\b[^}]*\}\s*from\s+.@/components/ui') { $needUi += 'Item' }
    $dividers = [regex]::Matches($content, '<Divider[\s>/]')
    if ($dividers.Count -gt 0 -and $content -notmatch '(?s)import\s*\{[^}]*\bDivider\b[^}]*\}\s*from\s+.@mui/material' -and $content -notmatch '(?s)import\s*\{[^}]*\bDivider\b[^}]*\}\s*from\s+.@/components/ui') { $needUi += 'Divider' }
    
    # --- Spectrum compat components ---
    $needCompat = @()
    $compatComps = @('AlertDialog', 'MenuTrigger', 'NumberField', 'TableBox', 'TagGroup')
    foreach ($cc in $compatComps) {
        $ccMatches = [regex]::Matches($content, "<$cc[\s>/]")
        if ($ccMatches.Count -gt 0 -and $content -notmatch "(?s)import[^;]*\b$cc\b[^;]*from") { $needCompat += $cc }
    }
    
    # --- MUI Icons ---
    $needIcons = @()
    $iconMap = @{
        'ArrowLeft' = "import ArrowLeft from '@mui/icons-material/ArrowBack';"
        'CheckmarkCircle' = "import { CheckCircle as CheckmarkCircle } from '@mui/icons-material';"
        'Refresh' = "import Refresh from '@mui/icons-material/Refresh';"
        'Settings' = "import Settings from '@mui/icons-material/Settings';"
        'Shield' = "import Shield from '@mui/icons-material/Shield';"
        'UserGroup' = "import { Groups as UserGroup } from '@mui/icons-material';"
    }
    foreach ($icon in $iconMap.Keys) {
        $iconMatches = [regex]::Matches($content, "<$icon[\s>/]")
        if ($iconMatches.Count -gt 0 -and $content -notmatch "(?s)import[^;]*\b$icon\b[^;]*from") {
            $needIcons += $icon
        }
    }
    
    if ($needMui.Count -eq 0 -and $needUi.Count -eq 0 -and $needCompat.Count -eq 0 -and $needIcons.Count -eq 0) { continue }
    
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
    foreach ($icon in $needIcons) {
        $newLines += $iconMap[$icon]
    }
    
    if ($newLines.Count -eq 0) { continue }
    
    # Find last import position
    $importMatches = [regex]::Matches($content, "(?m)^import\s+.*?from\s+['""][^'""]+['""];?\s*$")
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
        $nlPos = $content.IndexOf("`n", $lastPos)
        if ($nlPos -lt 0) { $nlPos = $lastPos }
        $insertText = "`n" + ($newLines -join "`n")
        $content = $content.Insert($nlPos, $insertText)
    } else {
        $content = ($newLines -join "`n") + "`n" + $content
    }
    
    [System.IO.File]::WriteAllText($f.FullName, $content)
    $fixCount++
    $added = $needMui.Count + $needUi.Count + $needCompat.Count + $needIcons.Count
    $totalAdded += $added
    Write-Output "FIXED: $fname (+$added)"
    if ($needMui.Count -gt 0) { Write-Output "  MUI: $($needMui -join ', ')" }
    if ($needUi.Count -gt 0) { Write-Output "  UI: $($needUi -join ', ')" }
    if ($needCompat.Count -gt 0) { Write-Output "  COMPAT: $($needCompat -join ', ')" }
    if ($needIcons.Count -gt 0) { Write-Output "  ICONS: $($needIcons -join ', ')" }
}

Write-Output ""
Write-Output "Fixed $fixCount files, added $totalAdded imports total"
