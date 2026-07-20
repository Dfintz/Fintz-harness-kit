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
$totalAdded = 0

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    $fname = $f.FullName.Replace('C:\Users\Fintz\OneDrive\Documents\GitHub\sc-fleet-manager\frontend\src\', '')
    
    # Check MUI components needed
    $needMui = @()
    if ($content -match '<Box[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bBox\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'Box' }
    if ($content -match '<Stack[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bStack\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'Stack' }
    if ($content -match '<Typography[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bTypography\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'Typography' }
    if ($content -match '<CircularProgress[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bCircularProgress\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'CircularProgress' }
    if ($content -match '<Tabs[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bTabs\b[^}]*\}\s*from\s+.@mui/material') { $needMui += 'Tabs' }
    
    # Check UI components needed
    $needUi = @()
    if ($content -match '<Button[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s+.@mui/material' -and $content -notmatch '(?s)import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s+.@/components/ui' -and $content -notmatch '(?s)import\s+Button\s+from\s+.@/components/ui') { $needUi += 'Button' }
    if ($content -match '<Select[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bSelect\b[^}]*\}\s*from\s+.@mui/material' -and $content -notmatch '(?s)import\s*\{[^}]*\bSelect\b[^}]*\}\s*from\s+.@/components/ui' -and $content -notmatch '(?s)import\s+Select\s+from\s+.@/components/ui') { $needUi += 'Select' }
    if ($content -match '<Checkbox[\s>/]' -and $content -notmatch '(?s)import\s*\{[^}]*\bCheckbox\b[^}]*\}\s*from\s+.@mui/material' -and $content -notmatch '(?s)import\s*\{[^}]*\bCheckbox\b[^}]*\}\s*from\s+.@/components/ui' -and $content -notmatch '(?s)import\s+Checkbox\s+from\s+.@/components/ui') { $needUi += 'Checkbox' }
    
    # Check Spectrum compat components needed
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
    $lines = Get-Content $f.FullName
    $newImports = @()
    
    # Build import lines
    if ($needMui.Count -gt 0) {
        # Check if there's an existing @mui/material import to extend
        $hasMuiImport = $content -match '(?s)import\s*\{[^}]*\}\s*from\s+.@mui/material'
        if ($hasMuiImport) {
            # Find the line with the closing brace of the existing MUI import
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match "from\s+['""]@mui/material['""]") {
                    # Find the opening brace line
                    $startLine = $i
                    while ($startLine -gt 0 -and $lines[$startLine] -notmatch 'import\s*\{') {
                        $startLine--
                    }
                    # Get all imported names from the existing import
                    $importBlock = ($lines[$startLine..$i]) -join ' '
                    $existingNames = @()
                    if ($importBlock -match '\{([^}]+)\}') {
                        $existingNames = $Matches[1] -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
                    }
                    $allNames = $existingNames + $needMui | Sort-Object -Unique
                    $newImportLine = "import { $($allNames -join ', ') } from '@mui/material';"
                    # Replace the multi-line import with single line
                    $before = if ($startLine -gt 0) { $lines[0..($startLine-1)] } else { @() }
                    $after = if ($i -lt $lines.Count - 1) { $lines[($i+1)..($lines.Count-1)] } else { @() }
                    $lines = @($before) + @($newImportLine) + @($after)
                    break
                }
            }
        } else {
            $newImports += "import { $($needMui -join ', ') } from '@mui/material';"
        }
    }
    
    if ($needUi.Count -gt 0) {
        # Check if there's an existing @/components/ui import to extend
        $hasUiImport = $content -match '(?s)import\s*\{[^}]*\}\s*from\s+.@/components/ui'
        if ($hasUiImport) {
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match "from\s+['""]@/components/ui['""]") {
                    $startLine = $i
                    while ($startLine -gt 0 -and $lines[$startLine] -notmatch 'import\s*\{') {
                        $startLine--
                    }
                    $importBlock = ($lines[$startLine..$i]) -join ' '
                    $existingNames = @()
                    if ($importBlock -match '\{([^}]+)\}') {
                        $existingNames = $Matches[1] -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
                    }
                    $allNames = $existingNames + $needUi | Sort-Object -Unique
                    $newImportLine = "import { $($allNames -join ', ') } from '@/components/ui';"
                    $before = if ($startLine -gt 0) { $lines[0..($startLine-1)] } else { @() }
                    $after = if ($i -lt $lines.Count - 1) { $lines[($i+1)..($lines.Count-1)] } else { @() }
                    $lines = @($before) + @($newImportLine) + @($after)
                    break
                }
            }
        } else {
            $newImports += "import { $($needUi -join ', ') } from '@/components/ui';"
        }
    }
    
    if ($needCompat.Count -gt 0) {
        # Check if there's an existing @/components/ui import (compat components are exported from there)
        # First check if we already handled a UI import above - re-read content
        $currentContent = $lines -join "`n"
        $hasUiImport2 = $currentContent -match '(?s)import\s*\{[^}]*\}\s*from\s+.@/components/ui'
        if ($hasUiImport2) {
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match "from\s+['""]@/components/ui['""]") {
                    $startLine = $i
                    while ($startLine -gt 0 -and $lines[$startLine] -notmatch 'import\s*\{') {
                        $startLine--
                    }
                    $importBlock = ($lines[$startLine..$i]) -join ' '
                    $existingNames = @()
                    if ($importBlock -match '\{([^}]+)\}') {
                        $existingNames = $Matches[1] -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
                    }
                    $allNames = $existingNames + $needCompat | Sort-Object -Unique
                    $newImportLine = "import { $($allNames -join ', ') } from '@/components/ui';"
                    $before = if ($startLine -gt 0) { $lines[0..($startLine-1)] } else { @() }
                    $after = if ($i -lt $lines.Count - 1) { $lines[($i+1)..($lines.Count-1)] } else { @() }
                    $lines = @($before) + @($newImportLine) + @($after)
                    break
                }
            }
        } else {
            $newImports += "import { $($needCompat -join ', ') } from '@/components/ui';"
        }
    }
    
    # If we have new import lines to add, find the right place
    if ($newImports.Count -gt 0) {
        # Find the last import line
        $lastImportIdx = -1
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^\s*import\s+" -or $lines[$i] -match "^\s*}\s*from\s+") {
                $lastImportIdx = $i
            }
            # Stop scanning after we're past imports (first non-import, non-blank, non-comment line)
            if ($i -gt 5 -and $lines[$i] -match '^\s*(export|const|let|var|function|class|interface|type|enum|declare|\/\/)' -and $lines[$i] -notmatch '^\s*export\s+\{') {
                break
            }
        }
        
        if ($lastImportIdx -ge 0) {
            $before = $lines[0..$lastImportIdx]
            $after = if ($lastImportIdx -lt $lines.Count - 1) { $lines[($lastImportIdx+1)..($lines.Count-1)] } else { @() }
            $lines = @($before) + @($newImports) + @($after)
        } else {
            # No imports found, add at top
            $lines = @($newImports) + @('') + @($lines)
        }
    }
    
    # Write the fixed file
    $lines | Set-Content $f.FullName -Encoding UTF8
    $added = $needMui.Count + $needUi.Count + $needCompat.Count
    $totalAdded += $added
    Write-Output "FIXED: $fname (+$added imports)"
    if ($needMui.Count -gt 0) { Write-Output "  MUI: $($needMui -join ', ')" }
    if ($needUi.Count -gt 0) { Write-Output "  UI: $($needUi -join ', ')" }
    if ($needCompat.Count -gt 0) { Write-Output "  COMPAT: $($needCompat -join ', ')" }
}

Write-Output ""
Write-Output "Fixed $fixCount files, added $totalAdded imports total"
