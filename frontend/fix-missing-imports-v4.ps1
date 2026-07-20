# fix-missing-imports-v4.ps1
# Comprehensive pass: fix ALL remaining undefined component/icon references
# Strategy: Add NEW import lines (never modify existing ones)

$srcDir = "src"
$fixedCount = 0
$totalImports = 0

# ============================================================
# COMPONENT MAPPINGS
# Components from @/components/ui
# ============================================================
$uiComponents = @(
    'AlertDialog',
    'Badge',
    'Box',
    'ButtonGroup',
    'CircularProgress',
    'Content',
    'Dialog',
    'DialogContainer',
    'DialogTrigger',
    'Divider',
    'Form',
    'Menu',
    'MenuTrigger',
    'NumberField',
    'ProgressCircle',
    'SearchField',
    'SpectrumItem',
    'Stack',
    'StatusLight',
    'Switch',
    'Tab',
    'TabList',
    'TabPanels',
    'Tabs',
    'TableBox',
    'TableHeader',
    'TagGroup',
    'TooltipTrigger',
    'Typography',
    'TypographyArea',
    'TypographyField',
    'Well'
)

# ============================================================
# ICON MAPPINGS
# MUI icon equivalents for Spectrum icons
# Each entry: ComponentName -> import statement
# ============================================================
$iconImports = @{
    'Add'              = "import Add from '@mui/icons-material/Add';"
    'ArrowLeft'        = "import { ArrowBack as ArrowLeft } from '@mui/icons-material';"
    'CheckmarkCircle'  = "import { CheckCircle as CheckmarkCircle } from '@mui/icons-material';"
    'Import'           = "import { FileUpload as Import } from '@mui/icons-material';"
    'Refresh'          = "import Refresh from '@mui/icons-material/Refresh';"
    'Settings'         = "import Settings from '@mui/icons-material/Settings';"
    'Shield'           = "import Shield from '@mui/icons-material/Shield';"
    'UserAdd'          = "import { PersonAdd as UserAdd } from '@mui/icons-material';"
    'UserGroup'        = "import { Groups as UserGroup } from '@mui/icons-material';"
    'VoiceOver'        = "import RecordVoiceOver from '@mui/icons-material/RecordVoiceOver';"
}

# For VoiceOver, the component name in JSX might be VoiceOver but the import is RecordVoiceOver
# We need a special alias approach
$iconAliasImports = @{
    'VoiceOver' = "import { RecordVoiceOver as VoiceOver } from '@mui/icons-material';"
}

# Combine icon imports
foreach ($key in $iconAliasImports.Keys) {
    $iconImports[$key] = $iconAliasImports[$key]
}

# ============================================================
# PROCESSING
# ============================================================

$files = Get-ChildItem -Path $srcDir -Recurse -Include "*.tsx","*.ts" | Where-Object {
    $_.FullName -notmatch '__tests__' -and
    $_.FullName -notmatch '\.test\.' -and
    $_.FullName -notmatch '\.spec\.' -and
    $_.FullName -notmatch 'node_modules' -and
    # Don't modify the UI library itself
    $_.FullName -notmatch 'components[\\/]ui[\\/]'
}

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $added = @()

    # --- Check UI components ---
    foreach ($comp in $uiComponents) {
        # Case-sensitive check: component used as JSX tag or destructured reference
        $usagePattern = "(?<![a-zA-Z])$comp(?![a-zA-Z])"
        if ([regex]::IsMatch($content, $usagePattern)) {
            # Check if already imported (case-sensitive)
            $importPattern = "(?s)import\s+.*?\b$comp\b.*?from\s+['""]"
            if (-not [regex]::IsMatch($content, $importPattern)) {
                # Also check for: import { ... Switch ... } or import Switch from
                $simpleImportCheck = "(?m)^import\s.*\b$comp\b"
                if (-not [regex]::IsMatch($content, $simpleImportCheck)) {
                    $added += $comp
                }
            }
        }
    }

    # Add UI component imports if needed
    if ($added.Count -gt 0) {
        $importLine = "import { $($added -join ', ') } from '@/components/ui';"
        # Insert after last import line
        if ($content -match '(?m)^import\s') {
            # Find position after last import statement
            $lines = $content -split "`n"
            $lastImportIdx = -1
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match '^\s*import\s') {
                    $lastImportIdx = $i
                    # If this import spans multiple lines (no semicolon), scan ahead
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
        } else {
            $content = $importLine + "`n" + $content
        }
        $totalImports += $added.Count
    }

    # --- Check icon components ---
    $iconAdded = $false
    foreach ($iconName in $iconImports.Keys) {
        $usagePattern = "(?<![a-zA-Z])$iconName(?![a-zA-Z])"
        if ([regex]::IsMatch($content, $usagePattern)) {
            # Special case: 'Add' can match too broadly (e.g. 'AddShip', 'addEventListener')
            # For 'Add', require it to appear as <Add or {Add} or = Add or (Add)
            if ($iconName -eq 'Add') {
                $strictPattern = '(<Add[\s/>]|\{Add\}|=\s*Add\b|\(Add\)|\bAdd\b\s*,)'
                if (-not [regex]::IsMatch($content, $strictPattern)) {
                    continue
                }
            }
            # Check not already imported
            $importCheck = "(?m)^import\s.*\b$iconName\b"
            if (-not [regex]::IsMatch($content, $importCheck)) {
                $importStatement = $iconImports[$iconName]
                # Insert after last import
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
                }
                $iconAdded = $true
                $totalImports++
            }
        }
    }

    if ($added.Count -gt 0 -or $iconAdded) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $fixedCount++
        Write-Host "FIXED: $($file.FullName) [$($added -join ', ')]$(if($iconAdded){' +icons'})" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Files fixed: $fixedCount"
Write-Host "Total imports added: $totalImports"
