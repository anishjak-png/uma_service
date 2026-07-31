# Starts the print bridge (used by Task Scheduler on login). No git pull - starts immediately.
. "$PSScriptRoot\config.ps1"

$ErrorActionPreference = "Stop"

$config = Get-ShopPcConfig
if ($config -and $config.projectPath -and (Test-Path $config.projectPath)) {
  $projectRoot = $config.projectPath
} else {
  $projectRoot = Get-ProjectRootFromScript -ScriptRoot $PSScriptRoot
  Save-ShopPcConfig -ProjectPath $projectRoot
}

if (Test-PrintBridgeRunning) {
  exit 0
}

Set-Location $projectRoot

if (-not (Test-Path ".env")) {
  Write-Error ".env missing in $projectRoot - run INSTALL.bat or edit .env with Supabase and printer settings."
  exit 1
}

npm run print-bridge
