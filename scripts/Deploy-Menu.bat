@echo off
REM ============================================
REM FirewallAI — One-Click Deployment Menu
REM ============================================
title FirewallAI Deployment
color 0B
echo.
echo   ╔══════════════════════════════════════════════╗
echo   ║   FirewallAI — Deployment Menu               ║
echo   ╚══════════════════════════════════════════════╝
echo.
echo   [1] Deploy ALL (Ubuntu + Kali)
echo   [2] Deploy to Ubuntu only
echo   [3] Deploy to Kali only
echo   [4] Deploy + Start Services
echo   [5] Deploy + Start + Launch Attack
echo   [6] Start React Frontend (this machine)
echo   [0] Exit
echo.
set /p choice="  Select option: "

if "%choice%"=="1" powershell -ExecutionPolicy Bypass -File "%~dp0Deploy-All.ps1"
if "%choice%"=="2" powershell -ExecutionPolicy Bypass -File "%~dp0Deploy-All.ps1" -Target ubuntu
if "%choice%"=="3" powershell -ExecutionPolicy Bypass -File "%~dp0Deploy-All.ps1" -Target kali
if "%choice%"=="4" powershell -ExecutionPolicy Bypass -File "%~dp0Deploy-All.ps1" -StartServices
if "%choice%"=="5" powershell -ExecutionPolicy Bypass -File "%~dp0Deploy-All.ps1" -StartServices -LaunchAttack
if "%choice%"=="6" (
    cd /d "%~dp0.."
    start cmd /k "npm run dev"
)
if "%choice%"=="0" exit

pause
