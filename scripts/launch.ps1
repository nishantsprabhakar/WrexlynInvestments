# Wrexlyn for Investments — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
# Unauthorized copying, modification, or distribution is prohibited. See LICENSE for details.
#
# Double-click entry point on Windows. No typing required: installs dependencies
# on first run, builds if needed, starts the server, and opens the browser
# automatically. Closing the console window stops the app.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step($text) {
    Write-Host $text -ForegroundColor Cyan
}

function Resolve-Tool($name, $fallbackPath) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    if (Test-Path $fallbackPath) { return $fallbackPath }
    return $null
}

$nodePath = Resolve-Tool "node" "C:\Program Files\nodejs\node.exe"
$npmPath = Resolve-Tool "npm" "C:\Program Files\nodejs\npm.cmd"

if (-not $nodePath -or -not $npmPath) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "Node.js is required but wasn't found. Please install it from https://nodejs.org, then double-click this launcher again.",
        "Wrexlyn for Investments - Node.js missing",
        "OK",
        "Error"
    ) | Out-Null
    exit 1
}

Write-Host ""
Write-Host "====================================" -ForegroundColor DarkCyan
Write-Host "        Wrexlyn for Investments" -ForegroundColor DarkCyan
Write-Host "====================================" -ForegroundColor DarkCyan
Write-Host ""

if (-not (Test-Path "$root\node_modules")) {
    Write-Step "First-time setup: installing dependencies (this can take a minute)..."
    & $npmPath install
    if ($LASTEXITCODE -ne 0) { Write-Host "Dependency install failed." -ForegroundColor Red; exit 1 }
}

# Rebuild if dist/ is missing OR stale relative to the checked-out commit.
$buildShaPath = "$root\dist\.build-sha"
$currentSha = $null
try { $currentSha = (& git -C $root rev-parse HEAD 2>$null); if ($LASTEXITCODE -ne 0) { $currentSha = $null } } catch { $currentSha = $null }

$needsBuild = -not (Test-Path "$root\dist\server\index.js")
if (-not $needsBuild -and $currentSha) {
    $builtSha = $null
    if (Test-Path $buildShaPath) { $builtSha = (Get-Content $buildShaPath -Raw -ErrorAction SilentlyContinue) }
    if ($builtSha -ne $currentSha) { $needsBuild = $true }
}

if ($needsBuild) {
    Write-Step "Building..."
    & $npmPath run build
    if ($LASTEXITCODE -ne 0) { Write-Host "Build failed." -ForegroundColor Red; exit 1 }
    if ($currentSha) { Set-Content -Path $buildShaPath -Value $currentSha -NoNewline }
}

$port = if ($env:PORT) { $env:PORT } else { 4500 }
$env:PORT = "$port"

Write-Host "Starting server and opening your browser..." -ForegroundColor DarkGray
Write-Host "(Close this window at any time to stop.)" -ForegroundColor DarkGray
Write-Host ""

Start-Process "powershell" -ArgumentList "-NoProfile -WindowStyle Hidden -File `"$root\scripts\open-browser-when-ready.ps1`" -Port $port" -WindowStyle Hidden | Out-Null

& $nodePath "$root\dist\server\index.js"
