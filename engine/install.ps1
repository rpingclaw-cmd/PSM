# Studio Engine installer for Windows (also updates an existing install - just run it again).
# Run in PowerShell:
#   irm https://raw.githubusercontent.com/rpingclaw-cmd/PSM/main/engine/install.ps1 | iex
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # makes downloads much faster in Windows PowerShell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo    = 'rpingclaw-cmd/PSM'
$Branch  = 'main'
$DfnTag  = 'v0.5.6'
$Home2   = Join-Path $env:LOCALAPPDATA 'StudioEngine'
$AppDir  = Join-Path $Home2 'app'
$BinDir  = Join-Path $Home2 'bin'

function Say($t) { Write-Host ''; Write-Host "==> $t" -ForegroundColor Cyan }
function Ok($t)  { Write-Host "    OK  $t" -ForegroundColor Green }
function Warn($t){ Write-Host "    !!  $t" -ForegroundColor Yellow }
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') +
              ';' + (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links') + ';' + (Join-Path $HOME '.local\bin')
}
function Find-Exe($name) { Refresh-Path; $c = Get-Command $name -ErrorAction SilentlyContinue; if ($c) { $c.Source } else { $null } }
function Winget-Install($id) {
  & winget install --id $id -e --silent --accept-source-agreements --accept-package-agreements | Out-Host
}

Write-Host '----------------------------------------------------------------'
Write-Host ' Studio Engine installer - this takes 5 to 15 minutes.'
Write-Host ' Nothing you edit is ever uploaded; this only installs free tools.'
Write-Host '----------------------------------------------------------------'
New-Item -ItemType Directory -Force -Path $Home2, $BinDir | Out-Null

# 1. uv (installs Python and the engine's parts, kept separate from the rest of the computer)
Say 'Step 1 of 5: uv (Python manager)'
$uv = Find-Exe 'uv'
if (-not $uv) {
  if (Get-Command winget -ErrorAction SilentlyContinue) { Winget-Install 'astral-sh.uv' }
  $uv = Find-Exe 'uv'
  if (-not $uv) { Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression; $uv = Find-Exe 'uv' }
}
if (-not $uv) { throw 'Could not install uv. Please send a screenshot of this window.' }
Ok "uv: $uv"

# 2. ffmpeg
Say 'Step 2 of 5: ffmpeg (video tool)'
$ff = Find-Exe 'ffmpeg'
if (-not $ff) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw 'winget is missing. Install "App Installer" from the Microsoft Store, then run this again.' }
  Winget-Install 'Gyan.FFmpeg'
  $ff = Find-Exe 'ffmpeg'
}
if ($ff) { Ok "ffmpeg: $ff" } else { Warn 'ffmpeg was installed but this window cannot see it yet. The engine will still find it.' }

# 3. engine program files (from GitHub)
Say 'Step 3 of 5: Studio Engine program'
$zip = Join-Path $env:TEMP 'studio-engine-src.zip'
$tmp = Join-Path $env:TEMP 'studio-engine-src'
Invoke-WebRequest "https://github.com/$Repo/archive/refs/heads/$Branch.zip" -OutFile $zip -UseBasicParsing
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
Expand-Archive $zip -DestinationPath $tmp -Force
$src = Get-ChildItem $tmp -Directory | Select-Object -First 1
if (Test-Path $AppDir) { Remove-Item $AppDir -Recurse -Force }
Copy-Item (Join-Path $src.FullName 'engine') $AppDir -Recurse
Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
Ok "installed in $AppDir"

# 4. DeepFilterNet voice isolation (ready-made program from the official release page)
Say 'Step 4 of 5: DeepFilterNet (voice isolation)'
$df = Join-Path $BinDir 'deep-filter.exe'
if (-not (Test-Path $df)) {
  $url = "https://github.com/Rikorose/DeepFilterNet/releases/download/$DfnTag/deep-filter-0.5.6-x86_64-pc-windows-msvc.exe"
  try {
    $rel = Invoke-RestMethod "https://api.github.com/repos/Rikorose/DeepFilterNet/releases/tags/$DfnTag" -UseBasicParsing
    $a = $rel.assets | Where-Object { $_.name -like '*x86_64-pc-windows*.exe' } | Select-Object -First 1
    if ($a) { $url = $a.browser_download_url }
  } catch { }
  Invoke-WebRequest $url -OutFile $df -UseBasicParsing
}
try { $v = & $df --version 2>&1; Ok "deep-filter: $v" }
catch { Warn 'Windows blocked deep-filter.exe (Smart App Control?). Voice isolation will be off; everything else works.' }

# 5. Python + engine libraries
Say 'Step 5 of 5: Python and libraries (first time: a few minutes)'
& $uv sync --project $AppDir --frozen --no-dev | Out-Host
if ($LASTEXITCODE -ne 0) {
  # Windows Smart App Control can block uv's own copy of Python; the official (signed) Python works.
  Warn 'Trying again with the official Python from python.org...'
  Winget-Install 'Python.Python.3.13'
  Refresh-Path
  & $uv sync --project $AppDir --frozen --no-dev --python-preference only-system | Out-Host
}
if ($LASTEXITCODE -ne 0) { throw 'Installing the Python libraries failed. Please send a screenshot of this window.' }
Ok 'libraries ready'

# Start file + desktop shortcut
$start = Join-Path $Home2 'Start Studio Engine.cmd'
@"
@echo off
title Studio Engine - keep this window open while you work
"$uv" run --project "$AppDir" --frozen --no-dev studio-engine
if errorlevel 1 pause
"@ | Set-Content -Path $start -Encoding ASCII
$ws = New-Object -ComObject WScript.Shell
foreach ($place in @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))) {
  $lnk = $ws.CreateShortcut((Join-Path $place 'Start Studio Engine.lnk'))
  $lnk.TargetPath = $start
  $lnk.WorkingDirectory = $Home2
  $lnk.IconLocation = "$env:SystemRoot\System32\imageres.dll,18"
  $lnk.Description = 'Studio Engine for the Daily Quote Cards Studio tab'
  $lnk.Save()
}
Ok 'Desktop shortcut "Start Studio Engine" created'

Write-Host ''
Write-Host 'All done! The Studio Engine is starting now and the website will open.' -ForegroundColor Green
Write-Host 'Next time just double-click "Start Studio Engine" on your desktop.' -ForegroundColor Green
Start-Process -FilePath $start
