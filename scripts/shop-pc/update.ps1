# Administrator manual update - git pull + npm install. Not run on login.
. "$PSScriptRoot\config.ps1"

$ErrorActionPreference = "Stop"

$config = Get-ShopPcConfig
if ($config -and $config.projectPath -and (Test-Path $config.projectPath)) {
  $projectRoot = $config.projectPath
} else {
  $projectRoot = Get-ProjectRootFromScript -ScriptRoot $PSScriptRoot
  Save-ShopPcConfig -ProjectPath $projectRoot
}

Set-Location $projectRoot

Write-Host ""
Write-Host "  Uma Traders - Print Bridge Update" -ForegroundColor Green
Write-Host "  =================================" -ForegroundColor Green
Write-Host ""

Write-Host "Stopping running bridge..." -ForegroundColor Cyan
$running = Test-PrintBridgeRunning
if ($running) {
  $running | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
}

Write-Host "git pull..." -ForegroundColor Cyan
git pull --ff-only
if ($LASTEXITCODE -ne 0) {
  Write-Host "git pull failed - fix network or conflicts before retrying." -ForegroundColor Red
  exit 1
}

Write-Host "npm install..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
  Write-Host "npm install failed." -ForegroundColor Red
  exit 1
}

Write-Host "prisma generate..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) {
  Write-Host "prisma generate failed." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Update complete. Restarting print bridge..." -ForegroundColor Green
$startScript = Join-Path $PSScriptRoot "start-bridge.ps1"
Start-Process powershell.exe -ArgumentList @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Minimized",
  "-File", "`"$startScript`""
)

Write-Host "Health dashboard: http://localhost:3005" -ForegroundColor DarkGray
Write-Host ""
