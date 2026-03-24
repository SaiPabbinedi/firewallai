#!/usr/bin/env pwsh
# =============================================================================
# FirewallAI -- Attack Demo Script (Repeatable)
# =============================================================================
# This script is designed for LIVE PRESENTATIONS. It:
#   1. Stops any running attacks
#   2. Clears previous logs
#   3. Lets you pick which attack to run
#   4. Monitors it live
#   5. Asks if you want to re-run when done
#
# Usage:
#   .\Demo-Attack.ps1                    # Interactive menu
#   .\Demo-Attack.ps1 -Duration 2        # 2 min per phase (faster demo)
# =============================================================================

param(
    [string]$KaliHost = '192.168.1.103',
    [string]$KaliUser = 'kali',
    [string]$Target = '192.168.1.1',
    [int]$Duration = 2,

    # pfSense config (needed only if real blocking is enabled)
    [string]$PfSenseHost = '192.168.1.1',
    [string]$PfSenseUser = 'admin'
)

$ErrorActionPreference = 'Continue'

# =============================================================================
# Helpers
# =============================================================================
function Write-Banner($text) {
    Write-Host ""
    Write-Host "+==============================================================+" -ForegroundColor Cyan
    Write-Host "|  $($text.PadRight(60))|" -ForegroundColor Cyan
    Write-Host "+==============================================================+" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Ok($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "  ->  $msg" -ForegroundColor Gray }

function SSH-Run($cmd) {
    $output = ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$KaliUser@$KaliHost" $cmd 2>&1
    return $output
}

# =============================================================================
# Step 1: Connect to Kali
# =============================================================================
function Test-KaliConnection {
    Write-Host "  Connecting to Kali ($KaliHost)..." -ForegroundColor Gray
    $result = ssh -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no "$KaliUser@$KaliHost" "echo ok" 2>$null
    if ($result -eq 'ok') {
        Write-Ok "Kali connected (key-based)"
        return $true
    }
    # Try ping
    $ping = Test-Connection -ComputerName $KaliHost -Count 1 -Quiet -ErrorAction SilentlyContinue
    if ($ping) {
        Write-Warn "Kali reachable but no SSH key -- you may be prompted for password"
        return $true
    }
    Write-Fail "Cannot reach Kali at $KaliHost"
    return $false
}

# =============================================================================
# Step 2: Kill any running attacks
# =============================================================================
function Stop-AllAttacks {
    Write-Info "Stopping any running attacks..."
    SSH-Run 'pkill -f run_full_test 2>/dev/null; pkill -f nmap 2>/dev/null; pkill -f hydra 2>/dev/null; pkill -f hping3 2>/dev/null; pkill -f nikto 2>/dev/null; pkill -f gobuster 2>/dev/null' | Out-Null
    Start-Sleep -Seconds 1

    $check = SSH-Run 'pgrep -f "nmap|hydra|hping3|nikto|run_full_test" || echo clean'
    if ($check -match 'clean') {
        Write-Ok "All previous attacks stopped"
    }
    else {
        Write-Warn "Some processes may still be running"
    }
}

# =============================================================================
# Step 3: Clear previous logs
# =============================================================================
function Clear-AttackLogs {
    Write-Info "Clearing previous attack logs..."
    SSH-Run 'rm -f ~/firewallai-attacks/logs/*.log 2>/dev/null' | Out-Null
    Write-Ok "Logs cleared -- fresh start"
}

# =============================================================================
# Step 4: Run an attack
# =============================================================================
function Start-FullAttack {
    Write-Banner "LAUNCHING FULL ATTACK SUITE"
    Write-Host "  Target:    $Target" -ForegroundColor Yellow
    Write-Host "  Duration:  $Duration min per phase" -ForegroundColor Yellow
    Write-Host "  Phases:    Port Scan -> Brute Force -> Web Attacks -> DDoS" -ForegroundColor Yellow
    Write-Host "  Total:     ~$($Duration * 4 + 2) minutes" -ForegroundColor Yellow
    Write-Host ""

    $attackCmd = "cd ~/firewallai-attacks; mkdir -p ./logs; nohup bash run_full_test.sh $Target $Duration ./logs > ./logs/attack_output.log 2>&1 &"
    SSH-Run $attackCmd | Out-Null
    Start-Sleep -Seconds 3

    $remotePid = SSH-Run 'pgrep -f run_full_test'
    if ($remotePid) {
        Write-Ok "Attack launched! (PID: $remotePid)"
    }
    else {
        Write-Fail "Attack may have failed to start"
    }
}

function Start-PortScan {
    Write-Banner "LAUNCHING PORT SCAN"
    Write-Host "  Target: $Target" -ForegroundColor Yellow
    Write-Host ""

    $cmd = "cd ~/firewallai-attacks; nohup bash attacks/port_scan.sh $Target all > ./logs/port_scan_live.log 2>&1 &"
    SSH-Run $cmd | Out-Null
    Start-Sleep -Seconds 2
    Write-Ok "Port scan started"
}

function Start-BruteForce {
    Write-Banner "LAUNCHING BRUTE FORCE ATTACK"
    Write-Host "  Target: $Target (SSH)" -ForegroundColor Yellow
    Write-Host ""

    $cmd = "cd ~/firewallai-attacks; nohup bash attacks/brute_force_ssh.sh $Target > ./logs/brute_force_live.log 2>&1 &"
    SSH-Run $cmd | Out-Null
    Start-Sleep -Seconds 2
    Write-Ok "Brute force started"
}

function Start-WebAttacks {
    Write-Banner "LAUNCHING WEB ATTACKS"
    Write-Host "  Target: http://$Target" -ForegroundColor Yellow
    Write-Host ""

    $cmd = "cd ~/firewallai-attacks; nohup bash attacks/web_attacks.sh http://$Target all > ./logs/web_attacks_live.log 2>&1 &"
    SSH-Run $cmd | Out-Null
    Start-Sleep -Seconds 2
    Write-Ok "Web attacks started"
}

function Start-DDoS {
    Write-Banner "LAUNCHING DDoS SIMULATION"
    Write-Host "  Target: $Target :80" -ForegroundColor Yellow
    Write-Host "  Duration: 60 seconds" -ForegroundColor Yellow
    Write-Host ""

    $cmd = "cd ~/firewallai-attacks; nohup bash attacks/ddos_simulation.sh $Target 80 60 all > ./logs/ddos_live.log 2>&1 &"
    SSH-Run $cmd | Out-Null
    Start-Sleep -Seconds 2
    Write-Ok "DDoS simulation started"
}

# =============================================================================
# Step 5: Monitor
# =============================================================================
function Show-LiveStatus {
    Write-Host ""
    Write-Host "  -- Attack Status --" -ForegroundColor Magenta
    $procs = SSH-Run 'ps aux --no-headers -o comm,pid,etime | grep -E "nmap|hydra|hping3|nikto|gobuster|run_full" | grep -v grep'
    if ($procs) {
        $procs | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    }
    else {
        Write-Info "No attacks currently running"
    }
    Write-Host ""
}

# =============================================================================
# Step 6: Unblock Kali from pfSense (if real blocking was used)
# =============================================================================
function Unblock-Kali {
    Write-Banner "UNBLOCK KALI FROM PFSENSE"

    Write-Host "  This removes Kali ($KaliHost) from pfSense's block list" -ForegroundColor Yellow
    Write-Host "  so attacks can work again after an AI-applied block." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  pfSense: $PfSenseUser@$PfSenseHost" -ForegroundColor Gray
    Write-Host ""

    $confirm = Read-Host "  Proceed? (y/n)"
    if ($confirm -ne 'y') {
        Write-Warn "Cancelled"
        return
    }

    Write-Info "Connecting to pfSense..."

    # Method 1: Remove from pfctl blocklist table
    Write-Info "Removing $KaliHost from pfctl blocklist..."
    $result1 = ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$PfSenseUser@$PfSenseHost" "pfctl -t blocklist -T delete $KaliHost 2>&1; pfctl -t snort2c -T delete $KaliHost 2>&1; pfctl -t virusprot -T delete $KaliHost 2>&1" 2>&1
    if ($result1) {
        $result1 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    }

    # Method 2: Remove easyrule blocks
    Write-Info "Clearing easyrule blocks..."
    $result2 = ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$PfSenseUser@$PfSenseHost" "easyrule pass wan tcp $KaliHost any any 2>&1" 2>&1
    if ($result2) {
        $result2 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    }

    Write-Ok "Unblock commands sent to pfSense"
    Write-Host ""
    Write-Host "  If above shows errors, the block may not have been active." -ForegroundColor DarkGray
    Write-Host "  You can also manually check: http://$PfSenseHost" -ForegroundColor DarkGray
    Write-Host "    -> Firewall -> Rules -> look for $KaliHost" -ForegroundColor DarkGray
    Write-Host ""
}

# =============================================================================
# MAIN LOOP
# =============================================================================
$running = $true

while ($running) {
    Write-Banner "FirewallAI -- Attack Demo Controller"

    Write-Host "  Config:" -ForegroundColor DarkGray
    Write-Host "    Kali:     $KaliUser@$KaliHost" -ForegroundColor DarkGray
    Write-Host "    Target:   $Target" -ForegroundColor DarkGray
    Write-Host "    Duration: $Duration min/phase" -ForegroundColor DarkGray
    Write-Host ""

    Write-Host "  [1]  Run FULL attack suite (all 4 phases)" -ForegroundColor White
    Write-Host "  [2]  Port Scan only" -ForegroundColor Cyan
    Write-Host "  [3]  Brute Force (SSH) only" -ForegroundColor Yellow
    Write-Host "  [4]  Web Attacks only" -ForegroundColor Magenta
    Write-Host "  [5]  DDoS Simulation only" -ForegroundColor Red
    Write-Host ""
    Write-Host "  [S]  Check attack status" -ForegroundColor DarkGray
    Write-Host "  [K]  STOP all running attacks" -ForegroundColor DarkYellow
    Write-Host "  [U]  UNBLOCK Kali from pfSense (if blocked)" -ForegroundColor Green
    Write-Host "  [C]  Clear logs and reset" -ForegroundColor DarkYellow
    Write-Host "  [0]  Exit" -ForegroundColor DarkGray
    Write-Host ""

    $choice = Read-Host "  Select option"

    # --- Connect + Clean before any attack ---
    if ($choice -in '1', '2', '3', '4', '5') {
        if (-not (Test-KaliConnection)) {
            Write-Fail "Cannot proceed without Kali connection"
            continue
        }

        # Stop previous attacks + clear logs
        Write-Host ""
        Stop-AllAttacks
        Clear-AttackLogs
        Write-Host ""

        switch ($choice) {
            '1' { Start-FullAttack }
            '2' { Start-PortScan }
            '3' { Start-BruteForce }
            '4' { Start-WebAttacks }
            '5' { Start-DDoS }
        }

        Write-Host ""
        Write-Host "  ================================================" -ForegroundColor DarkGray
        Write-Host "  Attack is running in the background on Kali." -ForegroundColor Green
        Write-Host "  Switch to your DASHBOARD to see detections live!" -ForegroundColor Green
        Write-Host "  ================================================" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "  Monitor command:" -ForegroundColor Yellow
        Write-Host "    ssh $KaliUser@$KaliHost 'tail -f ~/firewallai-attacks/logs/*.log'" -ForegroundColor Gray
        Write-Host ""

        # Wait for user to decide next action
        Show-LiveStatus

        Write-Host ""
        $again = Read-Host "  Press ENTER to return to menu, or type 'stop' to kill attacks"
        if ($again -eq 'stop') {
            Stop-AllAttacks
        }
    }
    elseif ($choice -eq 'S' -or $choice -eq 's') {
        if (Test-KaliConnection) { Show-LiveStatus }
    }
    elseif ($choice -eq 'K' -or $choice -eq 'k') {
        if (Test-KaliConnection) { Stop-AllAttacks }
        Write-Host ""
        Read-Host "  Press ENTER to continue"
    }
    elseif ($choice -eq 'C' -or $choice -eq 'c') {
        if (Test-KaliConnection) {
            Stop-AllAttacks
            Clear-AttackLogs
        }
        Write-Host ""
        Read-Host "  Press ENTER to continue"
    }
    elseif ($choice -eq 'U' -or $choice -eq 'u') {
        Unblock-Kali
        Read-Host "  Press ENTER to continue"
    }
    elseif ($choice -eq '0') {
        # Offer to clean up on exit
        if (Test-KaliConnection) {
            $cleanup = Read-Host "  Stop running attacks before exit? (y/n)"
            if ($cleanup -eq 'y') {
                Stop-AllAttacks
                Clear-AttackLogs
            }
        }
        $running = $false
        Write-Host "  Bye!" -ForegroundColor Cyan
    }
    else {
        Write-Warn "Invalid choice"
    }
}
