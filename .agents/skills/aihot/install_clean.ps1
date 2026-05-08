$cache = "C:\Users\ASUS\.gemini\antigravity\brain\d9b2867f-1566-4da6-b2f1-5feda06a3d0d\.system_generated\steps"
$dest = "c:\Users\ASUS\Desktop\糯米机二改\SULLYTEST2\.agents\skills\aihot"

# SKILL.md: skip first 4 lines (Source + blank + --- + blank)
$all = Get-Content (Join-Path $cache "13\content.md") -Encoding UTF8
$all[4..($all.Length-1)] | Out-File (Join-Path $dest "SKILL.md") -Encoding UTF8 -Force
Write-Host "SKILL.md: $($all.Length - 4) lines written"

# README.md: skip first 4 lines
$all2 = Get-Content (Join-Path $cache "21\content.md") -Encoding UTF8
$all2[4..($all2.Length-1)] | Out-File (Join-Path $dest "README.md") -Encoding UTF8 -Force
Write-Host "README.md: $($all2.Length - 4) lines written"
