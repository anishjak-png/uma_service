# Shared paths for shop PC print bridge scripts.
$script:ShopPcConfigDir = Join-Path $env:LOCALAPPDATA "UmaService"
$script:ShopPcConfigFile = Join-Path $script:ShopPcConfigDir "print-bridge.json"
$script:ShopPcTaskName = "Uma Traders Print Bridge"
$script:ShopPcRepoUrl = "https://github.com/anishjak-png/uma_service.git"

function Get-ShopPcConfig {
  if (-not (Test-Path $script:ShopPcConfigFile)) {
    return $null
  }
  return Get-Content $script:ShopPcConfigFile -Raw | ConvertFrom-Json
}

function Save-ShopPcConfig {
  param([string]$ProjectPath)
  if (-not (Test-Path $script:ShopPcConfigDir)) {
    New-Item -ItemType Directory -Path $script:ShopPcConfigDir -Force | Out-Null
  }
  @{ projectPath = $ProjectPath } | ConvertTo-Json | Set-Content $script:ShopPcConfigFile -Encoding UTF8
}

function Get-ProjectRootFromScript {
  param([string]$ScriptRoot)
  Resolve-Path (Join-Path $ScriptRoot "..\..") | Select-Object -ExpandProperty Path
}

function Test-PrintBridgeRunning {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*print-bridge*" }
}
