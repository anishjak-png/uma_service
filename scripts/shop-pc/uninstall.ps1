# Removes login startup task (does not delete repo or .env).
. "$PSScriptRoot\config.ps1"

Write-Host "Removing '$($script:ShopPcTaskName)' scheduled task..." -ForegroundColor Cyan
Unregister-ScheduledTask -TaskName $script:ShopPcTaskName -Confirm:$false -ErrorAction SilentlyContinue

$running = Test-PrintBridgeRunning
if ($running) {
  Write-Host "Stopping print bridge..." -ForegroundColor Cyan
  $running | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

Write-Host "Auto-start removed. Project files were kept." -ForegroundColor Green
