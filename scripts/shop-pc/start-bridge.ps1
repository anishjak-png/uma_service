# Starts the print bridge (used by Task Scheduler on login).
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
  Write-Error ".env missing in $projectRoot — edit .env with Supabase and printer settings."
  exit 1
}

# Pull latest bridge fixes silently; ignore failure if offline.
git pull --ff-only 2>$null | Out-Null

$logDir = Join-Path $projectRoot "logs"
if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$logFile = Join-Path $logDir "print-bridge.log"

"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Starting print bridge" | Add-Content $logFile

npm run print-bridge 2>&1 | Tee-Object -FilePath $logFile -Append
