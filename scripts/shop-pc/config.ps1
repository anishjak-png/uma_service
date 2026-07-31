# Shared paths for shop PC print bridge scripts.
$script:ShopPcConfigDir = Join-Path $env:LOCALAPPDATA "UmaService"
$script:ShopPcConfigFile = Join-Path $script:ShopPcConfigDir "print-bridge.json"
$script:ShopPcTaskName = "Uma Traders Print Bridge"
$script:ShopPcZipUrl = "https://github.com/anishjak-png/uma_service/archive/refs/heads/main.zip"
$script:ShopPcZipRootFolder = "uma_service-main"

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

function Install-ProjectFromZip {
  param(
    [string]$InstallDir,
    [string]$RepoDir
  )

  $zipFile = Join-Path $env:TEMP "uma_service-download.zip"
  $extractRoot = Join-Path $env:TEMP "uma_service-download"

  try {
    Invoke-WebRequest -Uri $script:ShopPcZipUrl -OutFile $zipFile -UseBasicParsing
  } catch {
    throw @"
Download failed. The GitHub repo may be private.

Fix one of these:
  1. Make github.com/anishjak-png/uma_service public (recommended for shop PCs)
  2. Copy the full uma_service project folder via USB to $RepoDir
  3. Ask your developer to run the install from a machine with GitHub access

Error: $($_.Exception.Message)
"@
  }

  if (Test-Path $extractRoot) {
    Remove-Item $extractRoot -Recurse -Force
  }
  Expand-Archive -Path $zipFile -DestinationPath $extractRoot -Force

  $extracted = Join-Path $extractRoot $script:ShopPcZipRootFolder
  if (-not (Test-Path $extracted)) {
    throw "Download archive had an unexpected folder layout."
  }

  if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  }

  if (Test-Path $RepoDir) {
    Remove-Item $RepoDir -Recurse -Force
  }
  Move-Item $extracted $RepoDir

  Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
  Remove-Item $extractRoot -Recurse -Force -ErrorAction SilentlyContinue

  return (Resolve-Path $RepoDir).Path
}

function Update-ProjectFromZip {
  param([string]$RepoDir)

  $envPath = Join-Path $RepoDir ".env"
  $envBackup = $null
  if (Test-Path $envPath) {
    $envBackup = Get-Content $envPath -Raw
  }

  $logsPath = Join-Path $RepoDir "logs"
  $logsBackup = Join-Path $env:TEMP "uma_service_logs_backup"
  $hadLogs = Test-Path $logsPath
  if ($hadLogs) {
    if (Test-Path $logsBackup) { Remove-Item $logsBackup -Recurse -Force }
    Copy-Item $logsPath $logsBackup -Recurse -Force
  }

  $parent = Split-Path $RepoDir -Parent
  Install-ProjectFromZip -InstallDir $parent -RepoDir $RepoDir | Out-Null

  if ($envBackup) {
    Set-Content -Path $envPath -Value $envBackup -Encoding UTF8
  }

  if ($hadLogs -and (Test-Path $logsBackup)) {
    if (-not (Test-Path $logsPath)) {
      New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
    }
    Copy-Item "$logsBackup\*" $logsPath -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $logsBackup -Recurse -Force -ErrorAction SilentlyContinue
  }
}
