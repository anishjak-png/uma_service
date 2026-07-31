# One-time shop PC setup: clone/update repo, npm install, .env, login startup task.
param(
  [string]$InstallDir = (Join-Path $env:USERPROFILE "UmaService"),
  [string]$ProjectPath = ""
)

. "$PSScriptRoot\config.ps1"

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ensure-Node {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Write-Host ""
    Write-Host "Node.js is required. Install from https://nodejs.org (LTS 20+)" -ForegroundColor Red
    Write-Host "Then run this installer again." -ForegroundColor Red
    exit 1
  }
  Write-Host "Node $(node -v)" -ForegroundColor DarkGray
}

function Ensure-Git {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) {
    Write-Host ""
    Write-Host "Git is required. Install from https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
  }
}

function Ensure-Project {
  param([string]$TargetPath, [string]$RepoUrl)

  if ($ProjectPath) {
    if (-not (Test-Path $ProjectPath)) {
      throw "Project path not found: $ProjectPath"
    }
    return (Resolve-Path $ProjectPath).Path
  }

  # Running INSTALL.bat from inside the repo — use current project.
  $scriptRoot = $PSScriptRoot
  if ($scriptRoot) {
    $candidate = Get-ProjectRootFromScript -ScriptRoot $scriptRoot
    $pkg = Join-Path $candidate "package.json"
    if ((Test-Path $pkg) -and (Select-String -Path $pkg -Pattern "print-bridge" -Quiet)) {
      Write-Step "Using existing project folder"
      Set-Location $candidate
      git pull --ff-only 2>$null
      return $candidate
    }
  }

  $repoDir = Join-Path $TargetPath "uma_service"

  if (Test-Path (Join-Path $repoDir ".git")) {
    Write-Step "Updating existing repo"
    Set-Location $repoDir
    git pull --ff-only
    return (Resolve-Path $repoDir).Path
  }

  if (Test-Path $repoDir) {
    throw "Folder exists but is not a git repo: $repoDir"
  }

  Write-Step "Cloning uma_service"
  if (-not (Test-Path $TargetPath)) {
    New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
  }
  git clone $RepoUrl $repoDir
  return (Resolve-Path $repoDir).Path
}

function Ensure-EnvFile {
  param([string]$Root)

  $envFile = Join-Path $Root ".env"
  $example = Join-Path $Root ".env.shop.example"

  if (Test-Path $envFile) {
    Write-Host ".env already exists — keeping your settings" -ForegroundColor DarkGray
    return
  }

  if (-not (Test-Path $example)) {
    throw ".env.shop.example not found in $Root"
  }

  Copy-Item $example $envFile
  Write-Host ""
  Write-Host "Created .env from template." -ForegroundColor Yellow
  Write-Host "Add your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from Supabase Dashboard -> Settings -> API." -ForegroundColor Yellow
  Write-Host "Confirm THERMAL_PRINTER_HOST (default 192.168.1.87)." -ForegroundColor Yellow
  Write-Host ""
  $open = Read-Host "Open .env in Notepad now? (Y/n)"
  if ($open -ne "n" -and $open -ne "N") {
    Start-Process notepad.exe $envFile
    Read-Host "Press Enter after saving .env"
  }
}

function Test-PrinterPort {
  param([string]$Root)

  $envContent = Get-Content (Join-Path $Root ".env") -Raw
  $host = if ($envContent -match 'THERMAL_PRINTER_HOST="([^"]+)"') { $Matches[1] } else { "192.168.1.87" }
  $port = if ($envContent -match 'THERMAL_PRINTER_PORT="([^"]+)"') { [int]$Matches[1] } else { 9100 }

  Write-Step "Testing printer $host`:$port"
  $result = Test-NetConnection -ComputerName $host -Port $port -WarningAction SilentlyContinue
  if ($result.TcpTestSucceeded) {
    Write-Host "Printer reachable" -ForegroundColor Green
  } else {
    Write-Host "Printer not reachable — check LAN/IP before shop opens." -ForegroundColor Yellow
  }
}

function Register-LoginStartup {
  param([string]$StartScript)

  Write-Step "Registering auto-start on Windows login"

  $ps = (Get-Command powershell.exe).Source
  $args = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$StartScript`""

  Unregister-ScheduledTask -TaskName $script:ShopPcTaskName -Confirm:$false -ErrorAction SilentlyContinue

  $action = New-ScheduledTaskAction -Execute $ps -Argument $args
  $trigger = New-ScheduledTaskTrigger -AtLogon -User $env:USERNAME
  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1)

  Register-ScheduledTask `
    -TaskName $script:ShopPcTaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Uma Traders — thermal receipt print bridge (Supabase Realtime)" `
    | Out-Null

  Write-Host "Task '$($script:ShopPcTaskName)' will run at every login." -ForegroundColor Green
}

Write-Host ""
Write-Host "  Uma Traders — Print Bridge Installer" -ForegroundColor Green
Write-Host "  ==================================" -ForegroundColor Green

Ensure-Node
Ensure-Git

try {
  $root = Ensure-Project -TargetPath $InstallDir -RepoUrl $script:ShopPcRepoUrl

  Write-Step "Installing npm packages (may take a few minutes)"
  Set-Location $root
  npm install

  Ensure-EnvFile -Root $root
  Save-ShopPcConfig -ProjectPath $root

  Test-PrinterPort -Root $root

  $startScript = Join-Path $PSScriptRoot "start-bridge.ps1"
  Register-LoginStartup -StartScript $startScript

  Write-Step "Starting print bridge now"
  Start-Process powershell.exe -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Minimized",
    "-File", "`"$startScript`""
  )

  Write-Host ""
  Write-Host "Done!" -ForegroundColor Green
  Write-Host "  - Bridge starts automatically on every login" -ForegroundColor DarkGray
  Write-Host "  - Log file: $root\logs\print-bridge.log" -ForegroundColor DarkGray
  Write-Host "  - To remove auto-start: Uninstall-PrintBridge.bat" -ForegroundColor DarkGray
  Write-Host ""
}
catch {
  Write-Host ""
  Write-Host "Install failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
