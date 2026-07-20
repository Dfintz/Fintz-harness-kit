# fix-missing-imports-v6.ps1
# Fix Briefcase, TabItem, TableBody, User references

$srcDir = "src"
$fixedCount = 0

$uiComponents = @('Briefcase', 'TabItem', 'TableBody', 'User')

$files = Get-ChildItem -Path $srcDir -Recurse -Include "*.tsx","*.ts" | Where-Object {
    $_.FullName -notmatch 'node_modules' -and
    $_.FullName -notmatch 'components[\\/]ui[\\/]'
}

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $added = @()

    foreach ($comp in $uiComponents) {
        # Use stricter check for 'User' (very common word) - only match <User or {User}
        if ($comp -eq 'User') {
            $usagePattern = '(<User[\s/>]|\bUser\b\s*[,\)])'
            if (-not [regex]::IsMatch($content, $usagePattern)) { continue }
        } else {
            $usagePattern = "(?<![a-zA-Z])$comp(?![a-zA-Z])"
            if (-not [regex]::IsMatch($content, $usagePattern)) { continue }
        }
        
        # Check not already imported
        $importPattern = "(?m)^import\s.*\b$comp\b"
        if (-not [regex]::IsMatch($content, $importPattern)) {
            $added += $comp
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
        Write-Host "FIXED: $($file.FullName) [$($added -join ', ')]" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Files fixed: $fixedCount"
