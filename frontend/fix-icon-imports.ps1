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

foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText($f.FullName)
    $fname = $f.FullName.Replace("$basePath\", '')
    
    $needAddIcon = $false
    $needImportIcon = $false
    
    # Check for <Add /> used as icon (not part of other names like AddShip)
    if ($content -match '<Add\s*/>' -and $content -notmatch '(?s)import[^;]*\bAdd\b[^;]*from[^;]*@mui/icons') {
        $needAddIcon = $true
    }
    
    # Check for <Import /> used as icon
    if ($content -match '<Import\s*/>' -and $content -notmatch '(?s)import[^;]*\bImport\b[^;]*from') {
        $needImportIcon = $true
    }
    
    if (-not $needAddIcon -and -not $needImportIcon) { continue }
    
    $newLines = @()
    if ($needAddIcon) {
        $newLines += "import Add from '@mui/icons-material/Add';"
    }
    if ($needImportIcon) {
        $newLines += "import { FileUpload as Import } from '@mui/icons-material';"
    }
    
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
    $icons = @()
    if ($needAddIcon) { $icons += 'Add' }
    if ($needImportIcon) { $icons += 'Import' }
    Write-Output "FIXED: $fname - Icons: $($icons -join ', ')"
}

Write-Output ""
Write-Output "Fixed $fixCount files with icon imports"
