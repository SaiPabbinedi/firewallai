#!/usr/bin/env pwsh
# =============================================================================
# FirewallAI -- Master Run Controller (Windows)
# =============================================================================
# Control the entire FirewallAI system from this Windows machine.
#
# Usage:
#   .\Run-FirewallAI.ps1                    # Interactive menu
#   .\Run-FirewallAI.ps1 -Action status     # Check status of all VMs
#   .\Run-FirewallAI.ps1 -Action start      # Start all backend services
#   .\Run-FirewallAI.ps1 -Action stop       # Stop all backend services
#   .\Run-FirewallAI.ps1 -Action attack     # Launch attacks from Kali
#   .\Run-FirewallAI.ps1 -Action frontend   # Start React dev server
#   .\Run-FirewallAI.ps1 -Action full       # Start everything (backend + frontend + attack)
#   .\Run-FirewallAI.ps1 -Action fix        # Fix deployment issues (resync missing files)
#   .\Run-FirewallAI.ps1 -Action logs       # Tail live logs from Ubuntu
# =============================================================================

param(
    [ValidateSet('menu', 'status', 'start', 'stop', 'attack', 'frontend', 'full', 'fix', 'logs')]
    [string]$Action = 'menu',

    # VM Configuration
    [string]$UbuntuHost = '192.168.1.101',
    [string]$UbuntuUser = 'ubuntu',
    [string]$KaliHost = '192.168.1.103',
    [string]$KaliUser = 'kali',

    # Attack Config
    [string]$AttackTarget = '192.168.1.1',
    [int]$AttackDuration = 5
)

$ErrorActionPreference = 'Continue'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent

# =============================================================================
# Pretty Output Helpers
# =============================================================================
function Write-Banner($text) {
    Write-Host ""
    Write-Host "+==============================================================+" -ForegroundColor Cyan
    Write-Host "|  $($text.PadRight(60))|" -ForegroundColor Cyan
    Write-Host "+==============================================================+" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Section($text) {
    Write-Host ""
    Write-Host "  -- $text --" -ForegroundColor Magenta
}

function Write-Ok($msg) {
    Write-Host "  [OK] $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
    Write-Host "  [WARN] $msg" -ForegroundColor DarkYellow
}

function Write-Fail($msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
}

function Write-Info($msg) {
    Write-Host "  -> $msg" -ForegroundColor Gray
}

# =============================================================================
# SSH Helpers
# =============================================================================
function Test-SSHConnection($user, $remoteHost) {
    # Try key-based auth first (BatchMode). If that fails, try without BatchMode
    # to see if the host is at least reachable (password auth will be used later).
    $result = ssh -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no "$user@$remoteHost" "echo ok" 2>$null
    if ($result -eq 'ok') {
        return $true
    }
    # BatchMode failed - check if host is reachable via ping
    $ping = Test-Connection -ComputerName $remoteHost -Count 1 -Quiet -ErrorAction SilentlyContinue
    if ($ping) {
        Write-Warn "  No SSH key for $remoteHost - you may be prompted for password"
        return $true
    }
    return $false
}

function Invoke-SSHCommand($user, $remoteHost, $command, [switch]$Silent) {
    if (-not $Silent) {
        Write-Info "Running on ${remoteHost}: $command"
    }
    $output = ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$user@$remoteHost" $command 2>&1
    return $output
}

function Send-FileSCP($localPath, $user, $remoteHost, $remotePath) {
    if (Test-Path $localPath) {
        scp -q -o StrictHostKeyChecking=no "$localPath" "${user}@${remoteHost}:${remotePath}" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "Sent: $(Split-Path -Leaf $localPath)"
        }
        else {
            Write-Fail "Failed: $(Split-Path -Leaf $localPath)"
        }
    }
    else {
        Write-Warn "Not found locally: $localPath"
    }
}

function Send-DirSCP($localDir, $user, $remoteHost, $remotePath) {
    if (Test-Path $localDir) {
        scp -rq -o StrictHostKeyChecking=no "$localDir" "${user}@${remoteHost}:${remotePath}" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "Sent directory: $(Split-Path -Leaf $localDir)/"
        }
        else {
            Write-Fail "Failed directory: $(Split-Path -Leaf $localDir)/"
        }
    }
}

# =============================================================================
# CONNECTIVITY CHECK
# =============================================================================
function Test-AllConnections {
    Write-Section "SSH Connectivity Check"

    $ubuntuOk = Test-SSHConnection $UbuntuUser $UbuntuHost
    if ($ubuntuOk) {
        Write-Ok "Ubuntu ($UbuntuHost) -- Connected"
    }
    else {
        Write-Fail "Ubuntu ($UbuntuHost) -- UNREACHABLE"
        Write-Host "    Fix: ssh-copy-id $UbuntuUser@$UbuntuHost" -ForegroundColor Gray
    }

    $kaliOk = Test-SSHConnection $KaliUser $KaliHost
    if ($kaliOk) {
        Write-Ok "Kali ($KaliHost) -- Connected"
    }
    else {
        Write-Fail "Kali ($KaliHost) -- UNREACHABLE"
        Write-Host "    Fix: ssh-copy-id $KaliUser@$KaliHost" -ForegroundColor Gray
    }

    return @{ Ubuntu = $ubuntuOk; Kali = $kaliOk }
}

# =============================================================================
# STATUS -- Check what's running on all VMs
# =============================================================================
function Get-SystemStatus {
    Write-Banner "FirewallAI -- System Status"

    $conn = Test-AllConnections

    # --- Ubuntu Status ---
    if ($conn.Ubuntu) {
        Write-Section "Ubuntu Server ($UbuntuHost)"

        # Check what directories exist
        $dirs = Invoke-SSHCommand $UbuntuUser $UbuntuHost 'ls ~/cyber-defense/ 2>/dev/null' -Silent
        Write-Info "Files in ~/cyber-defense/: $($dirs -join ', ')"

        # Check subdirectory structure (v2)
        $subdirs = Invoke-SSHCommand $UbuntuUser $UbuntuHost 'ls -d ~/cyber-defense/*/ 2>/dev/null | xargs -I% basename %' -Silent
        Write-Info "Subdirectories: $($subdirs -join ', ')"

        # Check systemd services
        foreach ($svc in @('elasticsearch', 'kafka', 'zookeeper', 'grafana-server', 'influxdb')) {
            $active = Invoke-SSHCommand $UbuntuUser $UbuntuHost "systemctl is-active $svc 2>/dev/null" -Silent
            # Note: $svc is a PS variable so double-quotes are needed here; 2>/dev/null is safe inside double-quotes for ssh args
            if ($active -eq 'active') {
                Write-Ok "$svc -- Running"
            }
            else {
                Write-Info "$svc -- $active"
            }
        }

        # Check application processes
        Write-Host ""
        foreach ($proc in @('server_v2.js', 'server.js', 'defense_engine', 'kafka_to_elasticsearch', 'udp_to_kafka')) {
            $remotePid = Invoke-SSHCommand $UbuntuUser $UbuntuHost "pgrep -f '$proc' 2>/dev/null | head -1" -Silent
            if ($remotePid) {
                Write-Ok "$proc -- Running (PID: $remotePid)"
            }
            else {
                Write-Info "$proc -- Not running"
            }
        }

        # Check PID files (v2 mechanism)
        $remotePids = Invoke-SSHCommand $UbuntuUser $UbuntuHost 'ls ~/cyber-defense/.pids/ 2>/dev/null' -Silent
        if ($remotePids) {
            Write-Info "PID files: $($remotePids -join ', ')"
        }

        # Health check
        Write-Host ""
        try {
            $health = Invoke-RestMethod "http://${UbuntuHost}:3001/health" -TimeoutSec 5 -ErrorAction Stop
            Write-Ok "Backend API -- HEALTHY (http://${UbuntuHost}:3001)"
            if ($health.version) { Write-Info "  Version: $($health.version)" }
            if ($health.ai) { Write-Info "  AI: $($health.ai.provider)" }
        }
        catch {
            Write-Warn "Backend API -- Not responding on port 3001"
        }

        try {
            $null = Invoke-WebRequest "http://${UbuntuHost}:3000" -TimeoutSec 5 -ErrorAction Stop
            Write-Ok "Grafana -- Accessible (http://${UbuntuHost}:3000)"
        }
        catch {
            Write-Info "Grafana -- Not accessible on port 3000"
        }
    }

    # --- Kali Status ---
    if ($conn.Kali) {
        Write-Section "Kali Linux ($KaliHost)"

        $kaliFiles = Invoke-SSHCommand $KaliUser $KaliHost 'ls ~/firewallai-attacks/ 2>/dev/null' -Silent
        Write-Info "Files in ~/firewallai-attacks/: $($kaliFiles -join ', ')"

        $attackScripts = Invoke-SSHCommand $KaliUser $KaliHost 'ls ~/firewallai-attacks/attacks/ 2>/dev/null' -Silent
        if ($attackScripts) {
            Write-Ok "Attack scripts present: $($attackScripts -join ', ')"
        }
        else {
            Write-Fail "Attack scripts subdirectory is EMPTY or MISSING!"
            Write-Warn "Run: .\Run-FirewallAI.ps1 -Action fix"
        }

        # Check for running attacks
        $attackPid = Invoke-SSHCommand $KaliUser $KaliHost 'pgrep -f run_full_test 2>/dev/null' -Silent
        if ($attackPid) {
            Write-Ok "Attack simulation -- Running (PID: $attackPid)"
        }
        else {
            Write-Info "No active attack simulation"
        }
    }

    # --- Windows (local) ---
    Write-Section "Windows (This Machine)"

    $nodeProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($nodeProc) {
        Write-Ok "Node.js dev server -- Running (PID: $($nodeProc.Id -join ', '))"
    }
    else {
        Write-Info "React dev server -- Not running"
    }

    Write-Host ""
}

# =============================================================================
# FIX -- Resync missing files without full redeploy
# =============================================================================
function Repair-Deployment {
    Write-Banner "FirewallAI -- Fix Deployment Issues"

    $conn = Test-AllConnections

    # --- Fix Ubuntu: Ensure v2 directory structure + scripts ---
    if ($conn.Ubuntu) {
        Write-Section "Fixing Ubuntu Server"

        # Ensure the v2 directory structure exists
        Write-Info "Creating v2 directory structure..."
        Invoke-SSHCommand $UbuntuUser $UbuntuHost 'mkdir -p ~/cyber-defense/backend ~/cyber-defense/spark ~/cyber-defense/connectors ~/cyber-defense/grafana/dashboards ~/cyber-defense/elasticsearch/templates ~/cyber-defense/logs ~/cyber-defense/.pids'

        $ScriptsDir = Join-Path $ProjectRoot 'scripts\ubuntu'

        # Sync backend files
        Write-Info "Syncing backend files..."
        Send-FileSCP (Join-Path $ScriptsDir 'server_v2.js')    $UbuntuUser $UbuntuHost '~/cyber-defense/backend/'
        Send-FileSCP (Join-Path $ScriptsDir 'package.json')     $UbuntuUser $UbuntuHost '~/cyber-defense/backend/'
        Send-FileSCP (Join-Path $ScriptsDir '.env.example')     $UbuntuUser $UbuntuHost '~/cyber-defense/backend/'

        # Sync defense engine
        Write-Info "Syncing defense engine..."
        Send-FileSCP (Join-Path $ScriptsDir 'defense_engine_v2.py') $UbuntuUser $UbuntuHost '~/cyber-defense/spark/'

        # Sync connectors
        Write-Info "Syncing connectors..."
        Send-FileSCP (Join-Path $ScriptsDir 'kafka_to_elasticsearch.py') $UbuntuUser $UbuntuHost '~/cyber-defense/connectors/'
        Send-FileSCP (Join-Path $ScriptsDir 'udp_to_kafka_v2.py')       $UbuntuUser $UbuntuHost '~/cyber-defense/connectors/'

        # Sync management scripts (v2)
        Write-Info "Syncing management scripts..."
        Send-FileSCP (Join-Path $ScriptsDir 'start_all.sh')  $UbuntuUser $UbuntuHost '~/cyber-defense/'
        Send-FileSCP (Join-Path $ScriptsDir 'stop_all.sh')   $UbuntuUser $UbuntuHost '~/cyber-defense/'

        # Also send the v1 management scripts (some people use these)
        $MgmtScriptsDir = Join-Path $ProjectRoot 'scripts'
        Send-FileSCP (Join-Path $MgmtScriptsDir 'ubuntu_start.sh')  $UbuntuUser $UbuntuHost '~/cyber-defense/'
        Send-FileSCP (Join-Path $MgmtScriptsDir 'ubuntu_stop.sh')   $UbuntuUser $UbuntuHost '~/cyber-defense/'
        Send-FileSCP (Join-Path $MgmtScriptsDir 'ubuntu_status.sh') $UbuntuUser $UbuntuHost '~/cyber-defense/'

        # Sync setup scripts
        Send-FileSCP (Join-Path $ScriptsDir 'elasticsearch_setup.sh') $UbuntuUser $UbuntuHost '~/cyber-defense/'
        Send-FileSCP (Join-Path $ScriptsDir 'grafana_setup.sh')       $UbuntuUser $UbuntuHost '~/cyber-defense/'
        Send-FileSCP (Join-Path $ScriptsDir 'kafka_config.sh')        $UbuntuUser $UbuntuHost '~/cyber-defense/'

        # Sync Grafana dashboards
        $GrafanaDir = Join-Path $ProjectRoot 'grafana\dashboards'
        Get-ChildItem "$GrafanaDir\*.json" -ErrorAction SilentlyContinue | ForEach-Object {
            Send-FileSCP $_.FullName $UbuntuUser $UbuntuHost '~/cyber-defense/grafana/dashboards/'
        }

        # Set permissions + create .env if not exists
        Write-Info "Setting permissions..."
        Invoke-SSHCommand $UbuntuUser $UbuntuHost 'chmod +x ~/cyber-defense/*.sh 2>/dev/null; chmod +x ~/cyber-defense/backend/*.sh 2>/dev/null'
        Invoke-SSHCommand $UbuntuUser $UbuntuHost 'if [ ! -f ~/cyber-defense/backend/.env ]; then cp ~/cyber-defense/backend/.env.example ~/cyber-defense/backend/.env; echo .env created; else echo .env already exists; fi'

        # Install npm deps if needed
        Write-Info "Checking npm dependencies..."
        Invoke-SSHCommand $UbuntuUser $UbuntuHost 'cd ~/cyber-defense/backend && npm install --production 2>&1 | tail -2'

        Write-Ok "Ubuntu fixed!"
    }

    # --- Fix Kali: Resend attack scripts ---
    if ($conn.Kali) {
        Write-Section "Fixing Kali Linux"

        $KaliScriptsDir = Join-Path $ProjectRoot 'scripts\kali_attacks'

        # Create directories
        Write-Info "Creating Kali directory structure..."
        Invoke-SSHCommand $KaliUser $KaliHost "mkdir -p ~/firewallai-attacks/attacks ~/firewallai-attacks/logs"

        # Send master test script
        Send-FileSCP (Join-Path $KaliScriptsDir 'run_full_test.sh') $KaliUser $KaliHost '~/firewallai-attacks/'

        # Send individual attack scripts
        $AttacksDir = Join-Path $KaliScriptsDir 'attacks'
        Write-Info "Sending attack scripts..."
        Get-ChildItem "$AttacksDir\*.sh" -ErrorAction SilentlyContinue | ForEach-Object {
            Send-FileSCP $_.FullName $KaliUser $KaliHost '~/firewallai-attacks/attacks/'
        }

        # Send README
        Send-FileSCP (Join-Path $KaliScriptsDir 'README.md') $KaliUser $KaliHost '~/firewallai-attacks/'

        # Set permissions
        Write-Info "Setting permissions..."
        Invoke-SSHCommand $KaliUser $KaliHost 'chmod +x ~/firewallai-attacks/*.sh ~/firewallai-attacks/attacks/*.sh'

        # Verify
        $verify = Invoke-SSHCommand $KaliUser $KaliHost 'ls ~/firewallai-attacks/attacks/' -Silent
        if ($verify) {
            Write-Ok "Kali attack scripts verified: $($verify -join ', ')"
        }
        else {
            Write-Fail "Attack scripts still missing after fix!"
        }

        # Check attack tools
        Write-Info "Checking installed attack tools..."
        Invoke-SSHCommand $KaliUser $KaliHost 'which nmap hping3 hydra nikto gobuster 2>/dev/null && echo All attack tools installed || echo Some tools missing - run: sudo apt install -y nmap hping3 hydra nikto gobuster'

        Write-Ok "Kali fixed!"
    }

    Write-Banner "Fix Complete -- Run status to verify"
}

# =============================================================================
# START -- Start all backend services on Ubuntu (v2 mechanism)
# =============================================================================
function Start-BackendServices {
    Write-Banner "FirewallAI -- Starting Backend Services"

    $conn = Test-AllConnections

    if (-not $conn.Ubuntu) {
        Write-Fail "Cannot connect to Ubuntu. Aborting."
        return
    }

    Write-Section "Starting services on Ubuntu ($UbuntuHost)"

    # Check if start_all.sh exists in ~/cyber-defense/
    $hasStartAll = Invoke-SSHCommand $UbuntuUser $UbuntuHost 'test -f ~/cyber-defense/start_all.sh && echo yes || echo no' -Silent

    if ($hasStartAll -eq 'yes') {
        Write-Info "Using start_all.sh (v2 -- full stack)..."
        $output = Invoke-SSHCommand $UbuntuUser $UbuntuHost 'cd ~/cyber-defense && bash start_all.sh 2>&1'
        $output | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    }
    else {
        # Fallback to old ubuntu_start.sh
        Write-Warn "start_all.sh not found, using ubuntu_start.sh (v1 -- lightweight)..."
        $hasOldStart = Invoke-SSHCommand $UbuntuUser $UbuntuHost 'test -f ~/cyber-defense/ubuntu_start.sh && echo yes || echo no' -Silent

        if ($hasOldStart -eq 'yes') {
            $output = Invoke-SSHCommand $UbuntuUser $UbuntuHost 'cd ~/cyber-defense && bash ubuntu_start.sh 2>&1'
            $output | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
        }
        else {
            Write-Fail "No startup script found! Run with -Action fix first."
            return
        }
    }

    # Wait and health check
    Write-Host ""
    Write-Info "Waiting 5 seconds for services to initialize..."
    Start-Sleep -Seconds 5

    try {
        $health = Invoke-RestMethod "http://${UbuntuHost}:3001/health" -TimeoutSec 10 -ErrorAction Stop
        Write-Ok "Backend API is LIVE!"
        Write-Info "  URL: http://${UbuntuHost}:3001"
        if ($health.version) { Write-Info "  Version: $($health.version)" }
    }
    catch {
        Write-Warn "Backend not responding yet -- may still be starting"
        Write-Info "  Check manually: ssh $UbuntuUser@$UbuntuHost 'tail -20 ~/cyber-defense/logs/backend.log'"
    }

    Write-Host ""
}

# =============================================================================
# STOP -- Stop all backend services on Ubuntu
# =============================================================================
function Stop-BackendServices {
    Write-Banner "FirewallAI -- Stopping Backend Services"

    $conn = Test-AllConnections

    if (-not $conn.Ubuntu) {
        Write-Fail "Cannot connect to Ubuntu. Aborting."
        return
    }

    Write-Section "Stopping services on Ubuntu ($UbuntuHost)"

    # Try v2 stop script first
    $hasStopAll = Invoke-SSHCommand $UbuntuUser $UbuntuHost 'test -f ~/cyber-defense/stop_all.sh && echo yes || echo no' -Silent

    if ($hasStopAll -eq 'yes') {
        Write-Info "Using stop_all.sh (v2)..."
        $output = Invoke-SSHCommand $UbuntuUser $UbuntuHost 'cd ~/cyber-defense && bash stop_all.sh 2>&1'
        $output | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    }
    else {
        Write-Warn "stop_all.sh not found, using ubuntu_stop.sh..."
        $output = Invoke-SSHCommand $UbuntuUser $UbuntuHost 'cd ~/cyber-defense && bash ubuntu_stop.sh 2>&1'
        $output | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    }

    # Also kill any stray processes
    Invoke-SSHCommand $UbuntuUser $UbuntuHost 'pkill -f "node server" 2>/dev/null; pkill -f defense_engine 2>/dev/null; pkill -f kafka_to_elasticsearch 2>/dev/null; pkill -f udp_to_kafka 2>/dev/null' -Silent

    Write-Ok "All services stopped"
}

# =============================================================================
# ATTACK -- Launch attack simulation from Kali
# =============================================================================
function Start-AttackSimulation {
    Write-Banner "FirewallAI -- Launch Attack Simulation"

    $conn = Test-AllConnections

    if (-not $conn.Kali) {
        Write-Fail "Cannot connect to Kali. Aborting."
        return
    }

    Write-Section "Verifying attack scripts on Kali ($KaliHost)"

    # Verify attack scripts exist
    $attackScripts = Invoke-SSHCommand $KaliUser $KaliHost 'ls ~/firewallai-attacks/attacks/ 2>/dev/null' -Silent
    if (-not $attackScripts) {
        Write-Fail "Attack scripts missing on Kali!"
        Write-Warn "Running fix first..."
        Repair-Deployment
    }

    Write-Section "Starting Attack Simulation"
    Write-Host ""
    Write-Host "  [WARN]  Target:    $AttackTarget" -ForegroundColor DarkYellow
    Write-Host "  [WARN]  Duration:  $AttackDuration minutes per phase" -ForegroundColor DarkYellow
    Write-Host "  [WARN]  Phases:    Port Scan -> Brute Force -> Web Attacks -> DDoS" -ForegroundColor DarkYellow
    Write-Host ""

    # Launch in background
    $attackCmd = "cd ~/firewallai-attacks; mkdir -p ./logs; nohup bash run_full_test.sh $AttackTarget $AttackDuration ./logs > ./logs/attack_output.log 2>&1 &"
    Invoke-SSHCommand $KaliUser $KaliHost $attackCmd

    Start-Sleep -Seconds 2

    $remotePid = Invoke-SSHCommand $KaliUser $KaliHost 'pgrep -f run_full_test 2>/dev/null' -Silent
    if ($remotePid) {
        Write-Ok "Attack simulation launched (PID: $remotePid)"
    }
    else {
        Write-Warn "Attack may have failed to start. Check logs:"
    }

    Write-Host ""
    Write-Host "  Monitor live:" -ForegroundColor Yellow
    Write-Host "    ssh $KaliUser@$KaliHost 'tail -f ~/firewallai-attacks/logs/attack_output.log'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Stop attack:" -ForegroundColor Yellow
    Write-Host "    ssh $KaliUser@$KaliHost 'pkill -f run_full_test'" -ForegroundColor Gray
    Write-Host ""
}

# =============================================================================
# FRONTEND -- Start React dev server on Windows
# =============================================================================
function Start-Frontend {
    Write-Banner "FirewallAI -- Starting React Frontend"

    Write-Info "Starting dev server at http://localhost:5173"
    Write-Info "Press Ctrl+C to stop"
    Write-Host ""

    Push-Location $ProjectRoot
    & npm run dev
    Pop-Location
}

# =============================================================================
# LOGS -- Tail live logs from Ubuntu
# =============================================================================
function Show-Logs {
    Write-Banner "FirewallAI -- Live Logs from Ubuntu"

    $conn = Test-AllConnections
    if (-not $conn.Ubuntu) {
        Write-Fail "Cannot connect to Ubuntu."
        return
    }

    Write-Info "Tailing logs from ~/cyber-defense/logs/ ..."
    Write-Info "Press Ctrl+C to stop"
    Write-Host ""

    $logCmd = 'tail -f ~/cyber-defense/logs/*.log'
    ssh "$UbuntuUser@$UbuntuHost" $logCmd
}

# =============================================================================
# FULL -- Start everything in the correct order
# =============================================================================
function Start-Everything {
    Write-Banner "FirewallAI -- FULL SYSTEM STARTUP"

    Write-Host "  This will:" -ForegroundColor Yellow
    Write-Host "    1. Start all backend services on Ubuntu" -ForegroundColor Gray
    Write-Host "    2. Launch attack simulation from Kali" -ForegroundColor Gray
    Write-Host "    3. Start React frontend on Windows" -ForegroundColor Gray
    Write-Host ""

    $confirm = Read-Host "  Proceed? (y/n)"
    if ($confirm -ne 'y') {
        Write-Warn "Cancelled."
        return
    }

    # Step 1: Start backend
    Start-BackendServices

    # Step 2: Launch attacks (in background on Kali)
    Start-AttackSimulation

    # Step 3: Frontend (this blocks -- runs in foreground)
    Write-Banner "SYSTEM READY"
    Write-Host "  +----------------------------------------------------------+" -ForegroundColor DarkGray
    Write-Host "  |  UBUNTU ($UbuntuHost)                                |" -ForegroundColor White
    Write-Host "  |    Backend:  http://${UbuntuHost}:3001/health         |" -ForegroundColor Gray
    Write-Host "  |    Grafana:  http://${UbuntuHost}:3000               |" -ForegroundColor Gray
    Write-Host "  +----------------------------------------------------------+" -ForegroundColor DarkGray
    Write-Host "  |  KALI ($KaliHost) -- Attack running in background     |" -ForegroundColor White
    Write-Host "  +----------------------------------------------------------+" -ForegroundColor DarkGray
    Write-Host "  |  WINDOWS -- Starting React at http://localhost:5173    |" -ForegroundColor White
    Write-Host "  +----------------------------------------------------------+" -ForegroundColor DarkGray
    Write-Host ""

    Start-Frontend
}

# =============================================================================
# INTERACTIVE MENU
# =============================================================================
function Show-Menu {
    Write-Banner "FirewallAI -- Master Controller"

    Write-Host "  [1]  Check Status (all VMs)" -ForegroundColor White
    Write-Host "  [2]  Start Backend Services (Ubuntu)" -ForegroundColor Green
    Write-Host "  [3]  Stop Backend Services (Ubuntu)" -ForegroundColor Red
    Write-Host "  [4]  Launch Attack Simulation (Kali)" -ForegroundColor Yellow
    Write-Host "  [5]  Start React Frontend (Windows)" -ForegroundColor Cyan
    Write-Host "  [6]  FULL START (Backend + Attack + Frontend)" -ForegroundColor Magenta
    Write-Host "  [7]  Fix/Resync Deployment Issues" -ForegroundColor DarkYellow
    Write-Host "  [8]  Tail Live Logs (Ubuntu)" -ForegroundColor Gray
    Write-Host "  [0]  Exit" -ForegroundColor DarkGray
    Write-Host ""

    $choice = Read-Host "  Select option"

    switch ($choice) {
        '1' { Get-SystemStatus }
        '2' { Start-BackendServices }
        '3' { Stop-BackendServices }
        '4' { Start-AttackSimulation }
        '5' { Start-Frontend }
        '6' { Start-Everything }
        '7' { Repair-Deployment }
        '8' { Show-Logs }
        '0' { Write-Host "  Bye!" -ForegroundColor Cyan; return }
        default { Write-Warn "Invalid choice"; Show-Menu }
    }
}

# =============================================================================
# MAIN ENTRY POINT
# =============================================================================
switch ($Action) {
    'menu' { Show-Menu }
    'status' { Get-SystemStatus }
    'start' { Start-BackendServices }
    'stop' { Stop-BackendServices }
    'attack' { Start-AttackSimulation }
    'frontend' { Start-Frontend }
    'full' { Start-Everything }
    'fix' { Repair-Deployment }
    'logs' { Show-Logs }
}
