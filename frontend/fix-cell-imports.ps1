# fix-cell-imports.ps1
$srcDir = "src"
$files = Get-ChildItem -Path $srcDir -Recurse -Include "*.tsx","*.ts" | Where-Object {
    $_.FullName -notmatch 'components[\\/]ui[\\/]' -and $_.FullName -notmatch 'node_modules'
}
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    if ([regex]::IsMatch($content, '<Cell[\s/>]') -and -not [regex]::IsMatch($content, "(?m)^import\s.*\bCell\b")) {
        $lines = $content -split "`n"
        $lastImportIdx = -1
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '^\s*import\s') {
                $lastImportIdx = $i
                if ($lines[$i] -notmatch ';\s*$') {
                    for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                        if ($lines[$j] -match ';\s*$' -or $lines[$j] -match "^\s*}\s*from\s") { $lastImportIdx = $j; break }
                    }
                }
            }
        }
        if ($lastImportIdx -ge 0) {
            $lines = [System.Collections.ArrayList]@($lines)
            $lines.Insert($lastImportIdx + 1, "import { Cell } from '@/components/ui';")
            $content = $lines -join "`n"
            Set-Content -Path $file.FullName -Value $content -NoNewline
            Write-Host "FIXED: $($file.FullName)" -ForegroundColor Green
        }
    }
}
