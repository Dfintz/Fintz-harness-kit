$ErrorActionPreference = 'SilentlyContinue'
$basePath = "C:\Users\Fintz\OneDrive\Documents\GitHub\sc-fleet-manager\frontend\src"
Set-Location $basePath

$files = Get-ChildItem -Recurse -Filter *.test.tsx | Where-Object {
    $_.FullName -notmatch 'node_modules'
}

$fixCount = 0

foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText($f.FullName)
    $fname = $f.FullName.Replace("$basePath\", '')
    
    # Check if file uses ThemeProvider without importing it
    if ($content -match 'ThemeProvider' -and $content -notmatch '(?s)import[^;]*ThemeProvider[^;]*from') {
        
        # Also check if 'theme' variable is used but not defined
        $needsCreateTheme = $false
        if ($content -match 'theme\s*=\s*createTheme' -or ($content -match '\btheme\b' -and $content -notmatch '(?s)(const|let|var)\s+theme\s*=')) {
            $needsCreateTheme = $true
        }
        
        $newLine = "import { createTheme, ThemeProvider } from '@mui/material';"
        if (-not $needsCreateTheme) {
            $newLine = "import { ThemeProvider } from '@mui/material/styles';"
        }
        
        # Check if there's already an import from @mui/material we can extend
        # Just add a new import line to be safe
        
        # Also add createTheme + theme if needed
        $themeDefLine = ""
        if ($content -match 'theme={theme}' -and $content -notmatch '(?s)(const|let|var)\s+theme\s*=') {
            $themeDefLine = "`nconst theme = createTheme();"
            $newLine = "import { createTheme, ThemeProvider } from '@mui/material';"
        }
        
        # Find last import line position
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
            $insertText = "`n" + $newLine + $themeDefLine
            $content = $content.Insert($nlPos, $insertText)
        } else {
            $content = $newLine + $themeDefLine + "`n" + $content
        }
        
        [System.IO.File]::WriteAllText($f.FullName, $content)
        $fixCount++
        Write-Output "FIXED: $fname"
    }
}

Write-Output ""
Write-Output "Fixed $fixCount test files with ThemeProvider imports"
