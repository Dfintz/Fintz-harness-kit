# fix-duplicate-imports.ps1
# Remove duplicate import lines added by batch fix scripts
# Strategy: For each file, find imports where the same identifier
# is imported from two different sources. Remove the LATER one
# (which is the one added by our scripts).

$srcDir = "src"
$fixedCount = 0

$files = Get-ChildItem -Path $srcDir -Recurse -Include "*.tsx","*.ts" | Where-Object {
    $_.FullName -notmatch 'node_modules'
}

foreach ($file in $files) {
    $lines = Get-Content $file.FullName
    $identifiers = @{} # Maps identifier -> first line index
    $linesToRemove = @()
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        
        # Skip non-import lines
        if ($line -notmatch '^\s*import\s') { continue }
        
        # Get the full import (handle multiline)
        $importLines = @($i)
        $importStmt = $line
        if ($line -notmatch ';\s*$' -and $line -notmatch "from\s+['""]") {
            for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                $importStmt += " " + $lines[$j].Trim()
                $importLines += $j
                if ($lines[$j] -match ';\s*$' -or $lines[$j] -match "from\s+['""]") {
                    break
                }
            }
        }
        
        # Extract named imports { A, B as C }
        $localNames = @()
        if ($importStmt -match '\{([^}]+)\}') {
            $names = $Matches[1] -split ','
            foreach ($name in $names) {
                $name = $name.Trim()
                if ($name -match '\s+as\s+(\w+)') {
                    $localNames += $Matches[1]
                } elseif ($name -match '^(\w+)') {
                    $localNames += $Matches[1]
                }
            }
        }
        # Default import
        elseif ($importStmt -match '^\s*import\s+(\w+)\s+from') {
            $localN = $Matches[1]
            if ($localN -ne 'type' -and $localN -ne 'React') {
                $localNames += $localN
            }
        }
        
        # Check for duplicates
        $hasDuplicate = $false
        foreach ($ln in $localNames) {
            if ($identifiers.ContainsKey($ln)) {
                $hasDuplicate = $true
                break
            }
        }
        
        if ($hasDuplicate) {
            # This import has at least one duplicate identifier
            # Check if ALL identifiers in this import are duplicates
            $allDuplicate = $true
            $newNames = @()
            foreach ($ln in $localNames) {
                if (-not $identifiers.ContainsKey($ln)) {
                    $allDuplicate = $false
                    $newNames += $ln
                }
            }
            
            if ($allDuplicate) {
                # Remove entire import line(s)
                foreach ($li in $importLines) {
                    $linesToRemove += $li
                }
            }
            # If partially duplicate, we'd need to edit the import
            # For simplicity, just log these
            elseif ($newNames.Count -lt $localNames.Count) {
                Write-Host "PARTIAL DUPLICATE in $($file.FullName) line $($i+1) - only some names are new: $($newNames -join ', ')" -ForegroundColor Yellow
            }
        }
        
        # Register all identifiers
        foreach ($ln in $localNames) {
            if (-not $identifiers.ContainsKey($ln)) {
                $identifiers[$ln] = $i + 1
            }
        }
    }
    
    if ($linesToRemove.Count -gt 0) {
        $newLines = @()
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($linesToRemove -notcontains $i) {
                $newLines += $lines[$i]
            }
        }
        Set-Content -Path $file.FullName -Value ($newLines -join "`n") -NoNewline
        $fixedCount++
        Write-Host "FIXED: $($file.FullName) - removed $($linesToRemove.Count) duplicate import line(s)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Files fixed: $fixedCount"
