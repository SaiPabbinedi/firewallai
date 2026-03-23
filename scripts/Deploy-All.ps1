param(
    [ValidateSet('all', 'ubuntu', 'kali')]
    [string]$Target = 'all',

    [switch]$SkipBuild,
    [switch]$StartServices,
    [switch]$LaunchAttack,

    [string]$UbuntuHost = '192.168.1.101',
    [string]$UbuntuUser = 'ubuntu',
    [string]$KaliHost = '192.168.1.103',
    [string]$KaliUser = 'kali'
)

$ErrorActionPreference = 'Continue'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent

# =========================
# Helpers
# =========================

function Write-Banner($text) {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host " $text" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($n, $total, $msg) {
    Write-Host "[$n/$total] $msg" -ForegroundColor Yellow
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

function Test-SSHConnection($user, $remoteHost) {
    $result = ssh -o ConnectTimeout=5 -o BatchMode=yes "$user@$remoteHost" "echo ok" 2>$null
    return ($result -eq "ok")
}

function Send-File($local, $user, $remoteHost, $remote) {
    if (Test-Path $local) {
        scp -q "$local" "${user}@${remoteHost}:$remote" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Ok (Split-Path -Leaf $local)
        }
        else {
            Write-Fail (Split-Path -Leaf $local)
        }
    }
    else {
        Write-Warn "Missing: $local"
    }
}

# =========================
Write-Banner "FirewallAI Deployment"

Write-Host "Project: $ProjectRoot" -ForegroundColor Gray
Write-Host "Target : $Target" -ForegroundColor Gray
Write-Host ""

# =========================
# STEP 1 - SSH CHECK
# =========================

Write-Step 1 6 "Checking SSH"

if ($Target -eq 'all' -or $Target -eq 'ubuntu') {
    if (Test-SSHConnection $UbuntuUser $UbuntuHost) {
        Write-Ok "Ubuntu SSH OK"
    }
    else {
        Write-Fail "Ubuntu SSH failed"
    }
}

if ($Target -eq 'all' -or $Target -eq 'kali') {
    if (Test-SSHConnection $KaliUser $KaliHost) {
        Write-Ok "Kali SSH OK"
    }
    else {
        Write-Fail "Kali SSH failed"
    }
}

# =========================
# STEP 2 - BUILD
# =========================

if (-not $SkipBuild) {
    Write-Step 2 6 "Building frontend"
    Push-Location $ProjectRoot
    npm run build
    Pop-Location
}
else {
    Write-Step 2 6 "Skipping build"
}

# =========================
# STEP 3 - UBUNTU DEPLOY
# =========================

if ($Target -eq 'all' -or $Target -eq 'ubuntu') {

    Write-Step 3 6 "Deploying Ubuntu"

    $UB = "$UbuntuUser@$UbuntuHost"
    $ScriptsDir = Join-Path $ProjectRoot "scripts\ubuntu"

    ssh $UB "mkdir -p ~/cyber-defense/backend"
    ssh $UB "mkdir -p ~/cyber-defense/spark"
    ssh $UB "mkdir -p ~/cyber-defense/connectors"

    Send-File (Join-Path $ScriptsDir "server_v2.js") $UbuntuUser $UbuntuHost "~/cyber-defense/backend/"
    Send-File (Join-Path $ScriptsDir "package.json") $UbuntuUser $UbuntuHost "~/cyber-defense/backend/"
    Send-File (Join-Path $ScriptsDir "defense_engine_v2.py") $UbuntuUser $UbuntuHost "~/cyber-defense/spark/"
    Send-File (Join-Path $ScriptsDir "kafka_to_elasticsearch.py") $UbuntuUser $UbuntuHost "~/cyber-defense/connectors/"

    ssh $UB "chmod +x ~/cyber-defense/* 2>/dev/null"

    Write-Ok "Ubuntu deployment done"
}

# =========================
# STEP 4 - KALI DEPLOY
# =========================

if ($Target -eq 'all' -or $Target -eq 'kali') {

    Write-Step 4 6 "Deploying Kali"

    $KB = "$KaliUser@$KaliHost"
    $KaliDir = Join-Path $ProjectRoot "scripts\kali_attacks"

    ssh $KB "mkdir -p ~/firewallai-attacks"

    Send-File (Join-Path $KaliDir "run_full_test.sh") $KaliUser $KaliHost "~/firewallai-attacks/"

    ssh $KB "chmod +x ~/firewallai-attacks/*.sh 2>/dev/null"

    Write-Ok "Kali deployment done"
}

# =========================
# STEP 5 - START SERVICES
# =========================

if ($StartServices -or $LaunchAttack) {

    Write-Step 5 6 "Starting services"

    $cmd = "cd ~/cyber-defense; bash start_all.sh"
    ssh "$UbuntuUser@$UbuntuHost" $cmd

    Start-Sleep -Seconds 5

    try {
        $health = Invoke-RestMethod "http://$UbuntuHost:3001/health" -TimeoutSec 10
        Write-Ok "Backend responding"
    }
    catch {
        Write-Warn "Backend not ready"
    }
}
else {
    Write-Step 5 6 "Skipping service start"
}

# =========================
# STEP 6 - ATTACK
# =========================

if ($LaunchAttack) {

    Write-Step 6 6 "Launching attack"

    $attackCmd = "cd ~/firewallai-attacks; nohup bash run_full_test.sh 192.168.1.1 > attack.log 2>&1 &"
    ssh "$KaliUser@$KaliHost" $attackCmd

    Write-Ok "Attack started"
}

Write-Banner "DEPLOYMENT COMPLETE"