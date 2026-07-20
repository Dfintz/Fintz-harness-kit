# fix-missing-imports-v5.ps1
# Fix remaining: Calendar, Clock, Column, Link (icon), Search, Tooltip in source files
# Also fix test files for ThemeProvider, DialogContainer, UserGroup

$srcDir = "src"
$fixedCount = 0
$totalImports = 0

# Components that need importing from @/components/ui
$uiComponents = @(
    'Calendar',
    'Clock',
    'Column',
    'Search',
    'Tooltip'
)

# For Link icon, only add if it's NOT from react-router-dom
# We handle Link specially below

# ============================================================
# PROCESS SOURCE FILES (not test files)
# ============================================================
$files = Get-ChildItem -Path $srcDir -Recurse -Include "*.tsx","*.ts" | Where-Object {
    $_.FullName -notmatch '\.test\.' -and
    $_.FullName -notmatch '\.spec\.' -and
    $_.FullName -notmatch '__tests__' -and
    $_.FullName -notmatch 'node_modules' -and
    $_.FullName -notmatch 'components[\\/]ui[\\/]'
}

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $added = @()

    foreach ($comp in $uiComponents) {
        # Case-sensitive JSX usage check: <Calendar or <Clock etc
        $usagePattern = "<$comp[\s/>]"
        if ([regex]::IsMatch($content, $usagePattern)) {
            # Check if already imported
            $importPattern = "(?m)^import\s.*\b$comp\b"
            if (-not [regex]::IsMatch($content, $importPattern)) {
                $added += $comp
            }
        }
    }

    # Handle Link specially - only if it's used as <Link /> or <Link size= (Spectrum icon)
    # NOT if used as <Link to= (React Router)
    if ([regex]::IsMatch($content, '<Link[\s/>]') -and
        [regex]::IsMatch($content, '<Link\s+(size|UNSAFE_style|sx)') -and
        -not [regex]::IsMatch($content, "(?m)^import.*\bLink\b.*from\s+['""]@/components/ui")) {
        # Check it's not React Router Link
        if (-not [regex]::IsMatch($content, "import.*\bLink\b.*from\s+['""]react-router")) {
            $added += 'Link'
        }
    }

    if ($added.Count -gt 0) {
        $importLine = "import { $($added -join ', ') } from '@/components/ui';"
        $lines = $content -split "`n"
        $lastImportIdx = -1
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '^\s*import\s') {
                $lastImportIdx = $i
                if ($lines[$i] -notmatch ';\s*$') {
                    for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                        if ($lines[$j] -match ';\s*$' -or $lines[$j] -match "^\s*}\s*from\s") {
                            $lastImportIdx = $j
                            break
                        }
                    }
                }
            }
        }
        if ($lastImportIdx -ge 0) {
            $lines = [System.Collections.ArrayList]@($lines)
            $lines.Insert($lastImportIdx + 1, $importLine)
            $content = $lines -join "`n"
        }
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $fixedCount++
        $totalImports += $added.Count
        Write-Host "FIXED: $($file.FullName) [$($added -join ', ')]" -ForegroundColor Green
    }
}

# ============================================================
# PROCESS TEST FILES - ThemeProvider, and remaining refs
# ============================================================
Write-Host "`n--- Fixing Test Files ---" -ForegroundColor Yellow

$testFiles = Get-ChildItem -Path $srcDir -Recurse -Include "*.test.tsx","*.test.ts","*.spec.tsx","*.spec.ts" | Where-Object {
    $_.FullName -notmatch 'node_modules'
}

foreach ($file in $testFiles) {
    $content = Get-Content $file.FullName -Raw
    $modified = $false

    # Fix ThemeProvider: add import if used but not imported
    if ([regex]::IsMatch($content, '\bThemeProvider\b') -and
        -not [regex]::IsMatch($content, "(?m)^import.*\bThemeProvider\b")) {
        $importLine = "import { createTheme, ThemeProvider } from '@mui/material';"
        $themeLine = "const theme = createTheme();"
        $lines = $content -split "`n"
        $lastImportIdx = -1
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '^\s*import\s') {
                $lastImportIdx = $i
                if ($lines[$i] -notmatch ';\s*$') {
                    for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                        if ($lines[$j] -match ';\s*$' -or $lines[$j] -match "^\s*}\s*from\s") {
                            $lastImportIdx = $j
                            break
                        }
                    }
                }
            }
        }
        if ($lastImportIdx -ge 0) {
            $lines = [System.Collections.ArrayList]@($lines)
            $lines.Insert($lastImportIdx + 1, $importLine)
            $lines.Insert($lastImportIdx + 2, $themeLine)
            $content = $lines -join "`n"
            $modified = $true
            Write-Host "FIXED (ThemeProvider): $($file.FullName)" -ForegroundColor Cyan
        }
    }

    # Fix createTheme: if ThemeProvider imported but createTheme not
    if ([regex]::IsMatch($content, '\bcreateTheme\b') -and
        -not [regex]::IsMatch($content, "(?m)^import.*\bcreateTheme\b") -and
        -not [regex]::IsMatch($content, "(?m)^const\s+theme\s*=\s*createTheme")) {
        # Already has ThemeProvider import, just need createTheme
        # Skip since the block above handles both together
    }

    # Fix UI component refs in test files (same logic as source files)
    $testUiComps = @('Calendar','Clock','Column','Search','Tooltip','DialogContainer','Content','Form','Menu','Switch','StatusLight','TableHeader','TooltipTrigger','SearchField','Well','NumberField','TypographyField','TypographyArea','AlertDialog','MenuTrigger','ButtonGroup','TabList','TabPanels','TagGroup','TableBox','ProgressCircle','Badge')
    $testAdded = @()
    foreach ($comp in $testUiComps) {
        $usagePattern = "(?<![a-zA-Z])$comp(?![a-zA-Z])"
        if ([regex]::IsMatch($content, $usagePattern)) {
            $importPattern = "(?m)^import\s.*\b$comp\b"
            if (-not [regex]::IsMatch($content, $importPattern)) {
                $testAdded += $comp
            }
        }
    }

    # Fix icon refs in test files
    $iconImports = @{
        'UserGroup' = "import { Groups as UserGroup } from '@mui/icons-material';"
        'Add'       = "import Add from '@mui/icons-material/Add';"
        'Shield'    = "import Shield from '@mui/icons-material/Shield';"
        'Settings'  = "import Settings from '@mui/icons-material/Settings';"
        'Refresh'   = "import Refresh from '@mui/icons-material/Refresh';"
    }

    $iconAdded = $false
    foreach ($iconName in $iconImports.Keys) {
        $usagePattern = "(?<![a-zA-Z])$iconName(?![a-zA-Z])"
        if ([regex]::IsMatch($content, $usagePattern)) {
            if ($iconName -eq 'Add') {
                $strictPattern = '(<Add[\s/>]|\{Add\}|=\s*Add\b)'
                if (-not [regex]::IsMatch($content, $strictPattern)) { continue }
            }
            $importCheck = "(?m)^import\s.*\b$iconName\b"
            if (-not [regex]::IsMatch($content, $importCheck)) {
                $importStatement = $iconImports[$iconName]
                $lines = $content -split "`n"
                $lastImportIdx = -1
                for ($i = 0; $i -lt $lines.Count; $i++) {
                    if ($lines[$i] -match '^\s*import\s') {
                        $lastImportIdx = $i
                        if ($lines[$i] -notmatch ';\s*$') {
                            for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                                if ($lines[$j] -match ';\s*$' -or $lines[$j] -match "^\s*}\s*from\s") {
                                    $lastImportIdx = $j
                                    break
                                }
                            }
                        }
                    }
                }
                if ($lastImportIdx -ge 0) {
                    $lines = [System.Collections.ArrayList]@($lines)
                    $lines.Insert($lastImportIdx + 1, $importStatement)
                    $content = $lines -join "`n"
                    $iconAdded = $true
                    $totalImports++
                }
            }
        }
    }

    if ($testAdded.Count -gt 0) {
        $importLine = "import { $($testAdded -join ', ') } from '@/components/ui';"
        $lines = $content -split "`n"
        $lastImportIdx = -1
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '^\s*import\s') {
                $lastImportIdx = $i
                if ($lines[$i] -notmatch ';\s*$') {
                    for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                        if ($lines[$j] -match ';\s*$' -or $lines[$j] -match "^\s*}\s*from\s") {
                            $lastImportIdx = $j
                            break
                        }
                    }
                }
            }
        }
        if ($lastImportIdx -ge 0) {
            $lines = [System.Collections.ArrayList]@($lines)
            $lines.Insert($lastImportIdx + 1, $importLine)
            $content = $lines -join "`n"
        }
        $totalImports += $testAdded.Count
        $modified = $true
    }

    if ($modified -or $iconAdded) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $fixedCount++
        if ($testAdded.Count -gt 0) {
            Write-Host "FIXED (test): $($file.FullName) [$($testAdded -join ', ')]$(if($iconAdded){' +icons'})" -ForegroundColor Cyan
        }
    }
}

Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Files fixed: $fixedCount"
Write-Host "Total imports added: $totalImports"
