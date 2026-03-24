@echo off
REM ============================================
REM FirewallAI — Double-Click Master Controller
REM ============================================
title FirewallAI Master Controller
color 0B
powershell -ExecutionPolicy Bypass -File "%~dp0Run-FirewallAI.ps1" -Action menu
pause
