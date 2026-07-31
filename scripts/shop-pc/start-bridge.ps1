# Starts the print bridge (used by Task Scheduler on login). No git pull — starts immediately.
. "$PSScriptRoot\config.ps1"

$ErrorActionPreference = "Stop"

$config = Get-ShopPcConfig
if (-not $config -or -not $config.projectPath) {
  Write-Error "Print bridge not installed. Run INSTALL.bat first."
  exit 1
}

$projectRoot = $config.projectPath
if (-not (Test-Path $projectRoot)) {
  Write-Error "Project folder not found: $projectRoot"
  exit 1
}

if (Test-PrintBridgeRunning) {
  exit 0
}

Set-Location $projectRoot

if (-not (Test-Path ".env")) {
  Write-Error ".env missing in $projectRoot — run INSTALL.bat or edit .env with Supabase and printer settings."
  exit 1
}

npm run print-bridge
