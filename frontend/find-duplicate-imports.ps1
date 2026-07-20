# find-duplicate-imports.ps1
# Find files that have duplicate named imports (same identifier imported twice)
$srcDir = "src"
$files = Get-ChildItem -Path $srcDir -Recurse -Include "*.tsx","*.ts" | Where-Object {
    $_.FullName -notmatch 'node_modules'
}

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    # Extract all imported identifiers
    $importMatches = [regex]::Matches($content, "(?m)^import\s+(.+?)$", [System.Text.RegularExpressions.RegexOptions]::Multiline)
    
    $identifiers = @{}
    $lineNum = 0
    $lines = $content -split "`n"
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match '^\s*import\s') {
            # Get the full import statement (may span multiple lines)
            $importStmt = $line
            if ($line -notmatch ';\s*$') {
                for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                    $importStmt += " " + $lines[$j].Trim()
                    if ($lines[$j] -match ';\s*$' -or $lines[$j] -match "from\s+['""]") {
                        break
                    }
                }
            }
            
            # Extract named imports: { A, B as C, D }
            if ($importStmt -match '\{([^}]+)\}') {
                $names = $Matches[1] -split ','
                foreach ($name in $names) {
                    $name = $name.Trim()
                    # Handle "X as Y" - the local name is Y
                    if ($name -match '\s+as\s+(\w+)') {
                        $localName = $Matches[1]
                    } else {
                        $localName = ($name -split '\s')[0]
                    }
                    if ($localName -and $localName.Length -gt 0) {
                        if ($identifiers.ContainsKey($localName)) {
                            Write-Host "DUPLICATE: $($file.FullName) - '$localName' imported on lines $($identifiers[$localName]) and $($i+1)" -ForegroundColor Red
                        } else {
                            $identifiers[$localName] = $i + 1
                        }
                    }
                }
            }
            # Handle default imports: import X from ...
            elseif ($importStmt -match '^\s*import\s+(\w+)\s+from') {
                $localName = $Matches[1]
                if ($localName -ne 'type' -and $localName -ne 'React') {
                    if ($identifiers.ContainsKey($localName)) {
                        Write-Host "DUPLICATE: $($file.FullName) - '$localName' imported on lines $($identifiers[$localName]) and $($i+1)" -ForegroundColor Red
                    } else {
                        $identifiers[$localName] = $i + 1
                    }
                }
            }
        }
    }
}
