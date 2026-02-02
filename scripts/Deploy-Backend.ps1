# ============================================
# FirewallAI - Deploy Backend to Ubuntu Server
# ============================================
# Run this from PowerShell on Windows to deploy
# the updated backend to your Ubuntu server
# ============================================

param(
    [string]$UbuntuHost = "192.168.1.101",
    [string]$UbuntuUser = "ubuntu"
)

$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  FirewallAI Backend Deployment" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target: $UbuntuUser@$UbuntuHost" -ForegroundColor Yellow
Write-Host ""

# Source files
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$UbuntuDir = Join-Path $ScriptDir "ubuntu"
$RemoteDir = "/home/$UbuntuUser/firewall-backend"

# Files to deploy
$Files = @(
    "server.js",
    "package.json",
    ".env.example",
    "ubuntu_start.sh",
    "ubuntu_stop.sh",
    "ubuntu_status.sh"
)

Write-Host "[1/5] Creating remote directory..." -ForegroundColor Yellow
ssh "$UbuntuUser@$UbuntuHost" "mkdir -p $RemoteDir"

Write-Host "[2/5] Copying backend files..." -ForegroundColor Yellow
foreach ($file in $Files) {
    $localFile = Join-Path $UbuntuDir $file
    if (Test-Path $localFile) {
        Write-Host "  Copying $file..." -ForegroundColor Gray
        scp $localFile "$UbuntuUser@$UbuntuHost`:$RemoteDir/"
    }
    else {
        Write-Host "  Skipping $file (not found)" -ForegroundColor DarkYellow
    }
}

Write-Host "[3/5] Copying startup scripts to home directory..." -ForegroundColor Yellow
ssh "$UbuntuUser@$UbuntuHost" "cp $RemoteDir/ubuntu_start.sh ~/ubuntu_start.sh 2>/dev/null; cp $RemoteDir/ubuntu_stop.sh ~/ubuntu_stop.sh 2>/dev/null; cp $RemoteDir/ubuntu_status.sh ~/ubuntu_status.sh 2>/dev/null"
ssh "$UbuntuUser@$UbuntuHost" "chmod +x ~/ubuntu_start.sh ~/ubuntu_stop.sh ~/ubuntu_status.sh"

Write-Host "[4/5] Setting permissions..." -ForegroundColor Yellow
ssh "$UbuntuUser@$UbuntuHost" "chmod +x $RemoteDir/*.sh 2>/dev/null"

Write-Host "[5/5] Checking for existing .env..." -ForegroundColor Yellow
$envExists = ssh "$UbuntuUser@$UbuntuHost" "test -f $RemoteDir/.env && echo 'exists'"
if ($envExists -ne "exists") {
    Write-Host "  Creating .env from template..." -ForegroundColor Gray
    ssh "$UbuntuUser@$UbuntuHost" "cp $RemoteDir/.env.example $RemoteDir/.env"
    Write-Host ""
    Write-Host "  WARNING: Please edit .env with your settings!" -ForegroundColor Yellow
    Write-Host "  ssh $UbuntuUser@$UbuntuHost" -ForegroundColor Gray
    Write-Host "  nano $RemoteDir/.env" -ForegroundColor Gray
}
else {
    Write-Host "  .env already exists, keeping current settings" -ForegroundColor Green
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. SSH into Ubuntu:" -ForegroundColor White
Write-Host "   ssh $UbuntuUser@$UbuntuHost" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Edit .env with your GROQ_API_KEY and pfSense credentials:" -ForegroundColor White
Write-Host "   nano $RemoteDir/.env" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Install dependencies (first time only):" -ForegroundColor White
Write-Host "   cd $RemoteDir && npm install" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Restart the backend:" -ForegroundColor White
Write-Host "   ./ubuntu_stop.sh && ./ubuntu_start.sh" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Check status:" -ForegroundColor White
Write-Host "   ./ubuntu_status.sh" -ForegroundColor Gray
Write-Host ""
