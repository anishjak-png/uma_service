# Administrator manual update - download latest + npm install. Not run on login.
. "$PSScriptRoot\config.ps1"

$ErrorActionPreference = "Stop"

$config = Get-ShopPcConfig
if ($config -and $config.projectPath -and (Test-Path $config.projectPath)) {
  $projectRoot = $config.projectPath
} else {
  $projectRoot = Join-Path (Join-Path $env:USERPROFILE "UmaService") "uma_service"
  if (-not (Test-Path $projectRoot)) {
    Write-Error "Print bridge not installed. Run INSTALL.bat first."
    exit 1
  }
}

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

Write-Host "Downloading latest code..." -ForegroundColor Cyan
Update-ProjectFromZip -RepoDir $projectRoot

Set-Location $projectRoot

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

Save-ShopPcConfig -ProjectPath $projectRoot

Write-Host ""
Write-Host "Update complete. Restarting print bridge..." -ForegroundColor Green
$startScript = Join-Path $PSScriptRoot "start-bridge.ps1"
Start-Process powershell.exe -ArgumentList @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Minimized",
  "-File", "`"$startScript`""
)

Write-Host "Health dashboard: http://localhost:3005" -ForegroundColor DarkGray
Write-Host ""
