#!/usr/bin/env pwsh
# =============================================================================
# FirewallAI — Master Deployment Script
# =============================================================================
# One-click deploy from Windows VM to Ubuntu Server + Kali Linux
#
# Usage:
#   .\Deploy-All.ps1                     # Deploy everything
#   .\Deploy-All.ps1 -Target ubuntu      # Deploy only to Ubuntu
#   .\Deploy-All.ps1 -Target kali        # Deploy only to Kali
#   .\Deploy-All.ps1 -SkipBuild          # Skip frontend build
#   .\Deploy-All.ps1 -StartServices      # Deploy + auto-start services
#   .\Deploy-All.ps1 -LaunchAttack       # Deploy + start services + run attacks
# =============================================================================

param(
    [ValidateSet('all', 'ubuntu', 'kali')]
    [string]$Target = 'all',

    [switch]$SkipBuild,
    [switch]$StartServices,
    [switch]$LaunchAttack,

    # VM Configuration
    [string]$UbuntuHost = '192.168.1.101',
    [string]$UbuntuUser = 'ubuntu',
    [string]$KaliHost = '192.168.1.103',
    [string]$KaliUser = 'kali'
)

$ErrorActionPreference = 'Continue'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent

# =============================================================================
# Colors & Helpers
# =============================================================================
function Write-Banner($text) {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  $($text.PadRight(60))║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($step, $total, $msg) {
    Write-Host "[$step/$total] $msg" -ForegroundColor Yellow
}

function Write-Ok($msg) {
    Write-Host "  ✓ $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
    Write-Host "  ⚠ $msg" -ForegroundColor DarkYellow
}

function Write-Fail($msg) {
    Write-Host "  ✗ $msg" -ForegroundColor Red
}

function Test-SSHConnection($user, $remoteHost) {
    $result = ssh -o ConnectTimeout=5 -o BatchMode=yes "$user@$remoteHost" "echo ok" 2>$null
    return $result -eq 'ok'
}

function Send-FileSCP($localPath, $user, $remoteHost, $remotePath) {
    if (Test-Path $localPath) {
        scp -q "$localPath" "${user}@${remoteHost}:${remotePath}" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "$(Split-Path -Leaf $localPath)"
        }
        else {
            Write-Fail "Failed: $(Split-Path -Leaf $localPath)"
        }
    }
    else {
        Write-Warn "Not found: $localPath"
    }
}

function Send-DirSCP($localDir, $user, $remoteHost, $remotePath) {
    if (Test-Path $localDir) {
        scp -rq "$localDir" "${user}@${remoteHost}:${remotePath}" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "$(Split-Path -Leaf $localDir)/"
        }
        else {
            Write-Fail "Failed: $(Split-Path -Leaf $localDir)/"
        }
    }
}

# =============================================================================
Write-Banner "FirewallAI — Master Deployment"
# =============================================================================

Write-Host "  Project:  $ProjectRoot" -ForegroundColor Gray
Write-Host "  Target:   $Target" -ForegroundColor Gray
Write-Host "  Ubuntu:   $UbuntuUser@$UbuntuHost" -ForegroundColor Gray
Write-Host "  Kali:     $KaliUser@$KaliHost" -ForegroundColor Gray
Write-Host ""

# =============================================================================
# PRE-FLIGHT: Check SSH connectivity
# =============================================================================
Write-Step 1 7 "Checking SSH connectivity..."

if ($Target -in 'all', 'ubuntu') {
    if (Test-SSHConnection $UbuntuUser $UbuntuHost) {
        Write-Ok "Ubuntu ($UbuntuHost) — SSH OK"
    }
    else {
        Write-Fail "Cannot SSH to Ubuntu ($UbuntuHost). Check credentials or run:"
        Write-Host "    ssh-copy-id $UbuntuUser@$UbuntuHost" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  Or manually: ssh $UbuntuUser@$UbuntuHost  (password: ubuntu)" -ForegroundColor Gray
        if ($Target -eq 'ubuntu') { exit 1 }
    }
}

if ($Target -in 'all', 'kali') {
    if (Test-SSHConnection $KaliUser $KaliHost) {
        Write-Ok "Kali ($KaliHost) — SSH OK"
    }
    else {
        Write-Warn "Cannot SSH to Kali ($KaliHost). Setting up SSH key..."
        Write-Host ""
        Write-Host "  Run this command and type 'kali' when prompted for password:" -ForegroundColor Yellow
        Write-Host "    ssh-copy-id $KaliUser@$KaliHost" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  Or if ssh-copy-id is unavailable on Windows, run:" -ForegroundColor Yellow
        Write-Host "    type `$env:USERPROFILE\.ssh\id_rsa.pub | ssh $KaliUser@$KaliHost 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys'" -ForegroundColor Gray
        Write-Host ""

        $continue = Read-Host "Have you set up SSH key? (y/n)"
        if ($continue -ne 'y') {
            Write-Host "  Trying password-based SSH. You'll be prompted for password multiple times." -ForegroundColor DarkYellow
        }
    }
}

# =============================================================================
# STEP 2: Build frontend (Windows)
# =============================================================================
if (-not $SkipBuild) {
    Write-Step 2 7 "Building React frontend..."
    Push-Location $ProjectRoot
    $buildResult = npm run build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Frontend build successful"
    }
    else {
        Write-Warn "Frontend build had warnings (non-blocking)"
    }
    Pop-Location
}
else {
    Write-Step 2 7 "Skipping frontend build (--SkipBuild)"
}

# =============================================================================
# STEP 3: Deploy to Ubuntu Server
# =============================================================================
if ($Target -in 'all', 'ubuntu') {
    Write-Step 3 7 "Deploying to Ubuntu Server ($UbuntuHost)..."
    Write-Host ""

    $UB = "$UbuntuUser@$UbuntuHost"
    $ScriptsDir = Join-Path $ProjectRoot 'scripts\ubuntu'
    $GrafanaDir = Join-Path $ProjectRoot 'grafana\dashboards'

    # --- Create remote directory structure ---
    Write-Host "  Creating directory structure..." -ForegroundColor Gray
    ssh $UB "mkdir -p ~/cyber-defense/{backend,spark,connectors,grafana/dashboards,elasticsearch/templates,logs}"

    # --- Backend (server_v2.js + package.json + .env) ---
    Write-Host "  [Backend]" -ForegroundColor Cyan
    Send-FileSCP (Join-Path $ScriptsDir 'server_v2.js')    $UbuntuUser $UbuntuHost '~/cyber-defense/backend/'
    Send-FileSCP (Join-Path $ScriptsDir 'package.json')     $UbuntuUser $UbuntuHost '~/cyber-defense/backend/'
    Send-FileSCP (Join-Path $ScriptsDir '.env.example')     $UbuntuUser $UbuntuHost '~/cyber-defense/backend/'

    # --- Spark Defense Engine ---
    Write-Host "  [Defense Engine]" -ForegroundColor Cyan
    Send-FileSCP (Join-Path $ScriptsDir 'defense_engine_v2.py') $UbuntuUser $UbuntuHost '~/cyber-defense/spark/'

    # --- Kafka-ES Connector ---
    Write-Host "  [Connectors]" -ForegroundColor Cyan
    Send-FileSCP (Join-Path $ScriptsDir 'kafka_to_elasticsearch.py') $UbuntuUser $UbuntuHost '~/cyber-defense/connectors/'
    Send-FileSCP (Join-Path $ScriptsDir 'udp_to_kafka_v2.py')       $UbuntuUser $UbuntuHost '~/cyber-defense/connectors/'

    # --- Setup Scripts ---
    Write-Host "  [Setup Scripts]" -ForegroundColor Cyan
    Send-FileSCP (Join-Path $ScriptsDir 'elasticsearch_setup.sh') $UbuntuUser $UbuntuHost '~/cyber-defense/'
    Send-FileSCP (Join-Path $ScriptsDir 'grafana_setup.sh')       $UbuntuUser $UbuntuHost '~/cyber-defense/'
    Send-FileSCP (Join-Path $ScriptsDir 'kafka_config.sh')        $UbuntuUser $UbuntuHost '~/cyber-defense/'

    # --- Grafana Dashboards ---
    Write-Host "  [Grafana Dashboards]" -ForegroundColor Cyan
    Get-ChildItem "$GrafanaDir\*.json" | ForEach-Object {
        Send-FileSCP $_.FullName $UbuntuUser $UbuntuHost '~/cyber-defense/grafana/dashboards/'
    }

    # --- Management Scripts ---
    Write-Host "  [Management Scripts]" -ForegroundColor Cyan
    $MgmtScriptsDir = Join-Path $ProjectRoot 'scripts'
    Send-FileSCP (Join-Path $MgmtScriptsDir 'ubuntu_start.sh')  $UbuntuUser $UbuntuHost '~/cyber-defense/'
    Send-FileSCP (Join-Path $MgmtScriptsDir 'ubuntu_stop.sh')   $UbuntuUser $UbuntuHost '~/cyber-defense/'
    Send-FileSCP (Join-Path $MgmtScriptsDir 'ubuntu_status.sh') $UbuntuUser $UbuntuHost '~/cyber-defense/'

    # Also send the new start_all.sh (v2 full stack starter)
    Send-FileSCP (Join-Path $ProjectRoot 'scripts\ubuntu\start_all.sh') $UbuntuUser $UbuntuHost '~/cyber-defense/'
    Send-FileSCP (Join-Path $ProjectRoot 'scripts\ubuntu\stop_all.sh')  $UbuntuUser $UbuntuHost '~/cyber-defense/'

    # --- Set permissions + create .env ---
    Write-Host "  Setting permissions..." -ForegroundColor Gray
    ssh $UB "chmod +x ~/cyber-defense/*.sh 2>/dev/null"
    ssh $UB "if [ ! -f ~/cyber-defense/backend/.env ]; then cp ~/cyber-defense/backend/.env.example ~/cyber-defense/backend/.env && echo '  .env created from template'; else echo '  .env already exists'; fi"

    # --- Install npm dependencies ---
    Write-Host "  Installing Node.js dependencies..." -ForegroundColor Gray
    ssh $UB "cd ~/cyber-defense/backend && npm install --production 2>&1 | tail -2"

    # --- Copy dashboards to Grafana provisioning ---
    Write-Host "  Provisioning Grafana dashboards..." -ForegroundColor Gray
    ssh $UB "sudo cp ~/cyber-defense/grafana/dashboards/*.json /var/lib/grafana/dashboards/ 2>/dev/null && echo '  Dashboards provisioned' || echo '  Grafana not installed yet (run grafana_setup.sh)'"

    Write-Ok "Ubuntu deployment complete"
}

# =============================================================================
# STEP 4: Deploy to Kali Linux
# =============================================================================
if ($Target -in 'all', 'kali') {
    Write-Step 4 7 "Deploying to Kali Linux ($KaliHost)..."
    Write-Host ""

    $KB = "$KaliUser@$KaliHost"
    $KaliScriptsDir = Join-Path $ProjectRoot 'scripts\kali_attacks'

    # --- Create remote directory ---
    ssh $KB "mkdir -p ~/firewallai-attacks/attacks ~/firewallai-attacks/logs"

    # --- Send attack scripts ---
    Write-Host "  [Attack Scripts]" -ForegroundColor Cyan
    Send-FileSCP (Join-Path $KaliScriptsDir 'run_full_test.sh') $KaliUser $KaliHost '~/firewallai-attacks/'

    $AttacksDir = Join-Path $KaliScriptsDir 'attacks'
    Get-ChildItem "$AttacksDir\*.sh" | ForEach-Object {
        Send-FileSCP $_.FullName $KaliUser $KaliHost '~/firewallai-attacks/attacks/'
    }

    # --- Send README ---
    Send-FileSCP (Join-Path $KaliScriptsDir 'README.md') $KaliUser $KaliHost '~/firewallai-attacks/'

    # --- Set permissions ---
    ssh $KB "chmod +x ~/firewallai-attacks/*.sh ~/firewallai-attacks/attacks/*.sh"

    # --- Install required tools ---
    Write-Host "  Checking attack tools..." -ForegroundColor Gray
    ssh $KB "which nmap hping3 hydra nikto > /dev/null 2>&1 && echo '  All tools installed' || echo '  Some tools missing — run: sudo apt install -y nmap hping3 hydra nikto'"

    Write-Ok "Kali deployment complete"
}

# =============================================================================
# STEP 5: Start Services on Ubuntu
# =============================================================================
if ($StartServices -or $LaunchAttack) {
    Write-Step 5 7 "Starting services on Ubuntu..."
    Write-Host ""

    $UB = "$UbuntuUser@$UbuntuHost"

    # Start all services in correct order
    ssh $UB "cd ~/cyber-defense && bash start_all.sh 2>&1" | ForEach-Object {
        Write-Host "  $_" -ForegroundColor Gray
    }

    # Wait for backend to be ready
    Write-Host "  Waiting for backend health check..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
    try {
        $health = Invoke-RestMethod "http://${UbuntuHost}:3001/health" -TimeoutSec 10
        Write-Ok "Backend is running (version: $($health.version), AI: $($health.ai.provider))"
    }
    catch {
        Write-Warn "Backend health check failed — may still be starting"
    }
}
else {
    Write-Step 5 7 "Skipping service startup (use -StartServices to auto-start)"
}

# =============================================================================
# STEP 6: Launch Attack Simulation (Kali)
# =============================================================================
if ($LaunchAttack) {
    Write-Step 6 7 "Launching attack simulation from Kali..."
    Write-Host ""

    $KB = "$KaliUser@$KaliHost"

    Write-Host "  ⚠ Starting attack simulation against pfSense (192.168.1.1)" -ForegroundColor DarkYellow
    Write-Host "  Duration: 5 minutes per attack phase" -ForegroundColor Gray
    Write-Host "  Phases: Port Scan → Brute Force → Web Attacks → DDoS" -ForegroundColor Gray
    Write-Host ""

    # Run in background on Kali so we don't block this script
    ssh $KB "cd ~/firewallai-attacks && nohup bash run_full_test.sh 192.168.1.1 5 ./logs > ./logs/attack_output.log 2>&1 &"
    ssh $KB "echo 'Attack PID:' && cat /tmp/attack_pid.txt 2>/dev/null || echo 'Running in background'"

    Write-Ok "Attack simulation launched in background on Kali"
    Write-Host "  Monitor: ssh $KaliUser@$KaliHost 'tail -f ~/firewallai-attacks/logs/attack_output.log'" -ForegroundColor Gray
}
else {
    Write-Step 6 7 "Skipping attack simulation (use -LaunchAttack to auto-attack)"
}

# =============================================================================
# STEP 7: Summary
# =============================================================================
Write-Step 7 7 "Deployment Summary"
Write-Host ""

Write-Banner "DEPLOYMENT COMPLETE"

Write-Host "  ┌──────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "  │  WINDOWS (This Machine)                                  │" -ForegroundColor White
Write-Host "  │    React Frontend:  npm run dev  (http://localhost:5173) │" -ForegroundColor Gray
Write-Host "  │    Build Output:    ./dist/                              │" -ForegroundColor Gray
Write-Host "  ├──────────────────────────────────────────────────────────┤" -ForegroundColor DarkGray
Write-Host "  │  UBUNTU SERVER ($UbuntuHost)                         │" -ForegroundColor White
Write-Host "  │    Backend API:     http://${UbuntuHost}:3001/health    │" -ForegroundColor Gray
Write-Host "  │    Grafana:         http://${UbuntuHost}:3000          │" -ForegroundColor Gray
Write-Host "  │    Elasticsearch:   http://${UbuntuHost}:9200          │" -ForegroundColor Gray
Write-Host "  │    Deploy path:     ~/cyber-defense/                    │" -ForegroundColor Gray
Write-Host "  ├──────────────────────────────────────────────────────────┤" -ForegroundColor DarkGray
Write-Host "  │  KALI LINUX ($KaliHost)                             │" -ForegroundColor White
Write-Host "  │    Attack scripts:  ~/firewallai-attacks/               │" -ForegroundColor Gray
Write-Host "  │    Run attacks:     bash run_full_test.sh 192.168.1.1   │" -ForegroundColor Gray
Write-Host "  └──────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
Write-Host ""

if (-not $StartServices) {
    Write-Host "  Quick Commands:" -ForegroundColor Yellow
    Write-Host "    Start Ubuntu services:  ssh $UbuntuUser@$UbuntuHost 'cd ~/cyber-defense && bash start_all.sh'" -ForegroundColor Gray
    Write-Host "    Stop Ubuntu services:   ssh $UbuntuUser@$UbuntuHost 'cd ~/cyber-defense && bash stop_all.sh'" -ForegroundColor Gray
    Write-Host "    Run attacks:            ssh $KaliUser@$KaliHost 'cd ~/firewallai-attacks && bash run_full_test.sh 192.168.1.1'" -ForegroundColor Gray
    Write-Host "    Open React (Windows):   npm run dev" -ForegroundColor Gray
    Write-Host ""
}
