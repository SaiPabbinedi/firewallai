#!/usr/bin/env pwsh
# =============================================================================
# FirewallAI -- Test Cases Runner
# =============================================================================
# Runs 3 structured test cases to validate the entire FirewallAI pipeline:
#   Test 1: Backend Health & AI Readiness
#   Test 2: AI Rule Generation (Groq/Ollama)
#   Test 3: Attack Detection & Response (End-to-End)
#
# Usage:
#   .\Test-FirewallAI.ps1                     # Run all 3 tests
#   .\Test-FirewallAI.ps1 -TestNumber 1       # Run only test 1
#   .\Test-FirewallAI.ps1 -TestNumber 2       # Run only test 2
#   .\Test-FirewallAI.ps1 -TestNumber 3       # Run only test 3
# =============================================================================

param(
    [int]$TestNumber = 0,
    [string]$BackendUrl = 'http://192.168.1.101:3001',
    [string]$KaliHost = '192.168.1.103',
    [string]$KaliUser = 'kali',
    [string]$Target = '192.168.1.1'
)

# =============================================================================
# Helpers
# =============================================================================
$totalPass = 0
$totalFail = 0
$testResults = @()

function Write-Banner($text) {
    Write-Host ""
    Write-Host "+==============================================================+" -ForegroundColor Cyan
    Write-Host "|  $($text.PadRight(60))|" -ForegroundColor Cyan
    Write-Host "+==============================================================+" -ForegroundColor Cyan
    Write-Host ""
}

function Write-TestHeader($testNum, $title, $description) {
    Write-Host ""
    Write-Host "  ============================================================" -ForegroundColor DarkCyan
    Write-Host "  TEST CASE $testNum : $title" -ForegroundColor Cyan
    Write-Host "  ============================================================" -ForegroundColor DarkCyan
    Write-Host "  $description" -ForegroundColor Gray
    Write-Host ""
}

function Assert-True($condition, $stepName) {
    if ($condition) {
        Write-Host "    [PASS] $stepName" -ForegroundColor Green
        $script:totalPass++
        $script:testResults += @{ Step = $stepName; Result = 'PASS' }
    }
    else {
        Write-Host "    [FAIL] $stepName" -ForegroundColor Red
        $script:totalFail++
        $script:testResults += @{ Step = $stepName; Result = 'FAIL' }
    }
}

function Assert-NotNull($value, $stepName) {
    Assert-True ($null -ne $value -and $value -ne '') $stepName
}

function Write-Detail($msg) {
    Write-Host "           $msg" -ForegroundColor DarkGray
}

# =============================================================================
# TEST CASE 1: Backend Health & AI Readiness
# =============================================================================
# Objective : Verify that the backend server is running, responsive,
#             and the AI provider (Groq or Ollama) is initialized.
# Preconditions: Backend started on Ubuntu via Run-FirewallAI.ps1 -Action start
# Expected : /health returns status=running, AI provider is ready
# =============================================================================
function Run-Test1 {
    Write-TestHeader 1 "Backend Health & AI Readiness" `
        "Validates the backend API is live and AI engine is initialized."

    # --- Step 1.1: Health endpoint reachable ---
    Write-Host "  Step 1.1: Health Endpoint" -ForegroundColor Yellow
    $health = $null
    try {
        $health = Invoke-RestMethod "$BackendUrl/health" -TimeoutSec 10 -ErrorAction Stop
    }
    catch {
        Write-Host "           Error: $($_.Exception.Message)" -ForegroundColor Red
    }

    Assert-NotNull $health "GET /health returns a response"
    Assert-True ($health.status -eq 'running') "Status is 'running'"
    Assert-True ($health.version -ne $null) "Version field present (got: $($health.version))"
    Assert-True ($health.uptime -gt 0) "Uptime > 0 seconds (got: $([math]::Round($health.uptime, 1))s)"
    Write-Detail "Platform: $($health.platform)"

    # --- Step 1.2: AI Provider Status ---
    Write-Host ""
    Write-Host "  Step 1.2: AI Provider Check" -ForegroundColor Yellow
    Assert-NotNull $health.ai "AI configuration present in health response"
    Assert-NotNull $health.ai.provider "AI provider is set (got: $($health.ai.provider))"

    $aiReady = ($health.ai.groq_ready -eq $true) -or ($health.ai.ollama_ready -eq $true)
    Assert-True $aiReady "At least one AI provider is ready (Groq: $($health.ai.groq_ready), Ollama: $($health.ai.ollama_ready))"
    Write-Detail "Active model: $($health.ai.active_model)"

    # --- Step 1.3: AI Providers detail endpoint ---
    Write-Host ""
    Write-Host "  Step 1.3: AI Providers Detail" -ForegroundColor Yellow
    $providers = $null
    try {
        $providers = Invoke-RestMethod "$BackendUrl/api/ai/providers" -TimeoutSec 10 -ErrorAction Stop
    }
    catch {}

    Assert-NotNull $providers "GET /api/ai/providers returns a response"
    Assert-NotNull $providers.current "Current provider reported (got: $($providers.current))"

    # --- Step 1.4: Stats endpoint ---
    Write-Host ""
    Write-Host "  Step 1.4: Realtime Stats Endpoint" -ForegroundColor Yellow
    $stats = $null
    try {
        $stats = Invoke-RestMethod "$BackendUrl/api/stats/realtime" -TimeoutSec 10 -ErrorAction Stop
    }
    catch {}

    Assert-NotNull $stats "GET /api/stats/realtime returns a response"
    Assert-True ($null -ne $stats.eventsProcessed) "eventsProcessed field present"

    # --- Step 1.5: Audit Log endpoint ---
    Write-Host ""
    Write-Host "  Step 1.5: Audit Log Endpoint" -ForegroundColor Yellow
    $audit = $null
    try {
        $audit = Invoke-RestMethod "$BackendUrl/api/audit-log" -TimeoutSec 10 -ErrorAction Stop
    }
    catch {}

    Assert-True ($null -ne $audit) "GET /api/audit-log returns a response"
}

# =============================================================================
# TEST CASE 2: AI Rule Generation
# =============================================================================
# Objective : Send natural language prompts to the AI engine and verify it
#             returns valid, structured firewall rules.
# Preconditions: Backend running, at least one AI provider configured.
# Expected : AI returns JSON with type, target, action, reason, confidence
# =============================================================================
function Run-Test2 {
    Write-TestHeader 2 "AI Rule Generation" `
        "Tests the AI engine's ability to generate firewall rules from natural language."

    # --- Step 2.1: Block an IP address ---
    Write-Host "  Step 2.1: Generate Rule -- Block IP" -ForegroundColor Yellow
    Write-Detail "Prompt: 'Block the IP 10.0.0.55 because it is doing port scanning'"
    $rule1 = $null
    try {
        $body = @{
            prompt = 'Block the IP 10.0.0.55 because it is doing port scanning'
        } | ConvertTo-Json

        $rule1 = Invoke-RestMethod "$BackendUrl/api/generate-rule" `
            -Method POST `
            -Body $body `
            -ContentType 'application/json' `
            -TimeoutSec 30 `
            -ErrorAction Stop
    }
    catch {
        Write-Host "           Error: $($_.Exception.Message)" -ForegroundColor Red
    }

    Assert-NotNull $rule1 "POST /api/generate-rule returns a response"
    Assert-True ($rule1.success -eq $true) "Response indicates success"
    Assert-True ($rule1.rule.type -eq 'ip') "Rule type is 'ip' (got: $($rule1.rule.type))"
    Assert-True ($rule1.rule.target -eq '10.0.0.55') "Rule target is '10.0.0.55' (got: $($rule1.rule.target))"
    Assert-True ($rule1.rule.action -eq 'block') "Rule action is 'block' (got: $($rule1.rule.action))"
    Assert-NotNull $rule1.rule.reason "Rule has a reason"
    Assert-True ($rule1.rule.confidence -gt 0) "Rule has confidence > 0 (got: $($rule1.rule.confidence))"
    Assert-NotNull $rule1.provider "Provider reported (got: $($rule1.provider))"
    Write-Detail "Reason: $($rule1.rule.reason)"
    Write-Detail "Confidence: $([math]::Round($rule1.rule.confidence * 100))%"

    # --- Step 2.2: Block a domain ---
    Write-Host ""
    Write-Host "  Step 2.2: Generate Rule -- Block Domain" -ForegroundColor Yellow
    Write-Detail "Prompt: 'Block malware-c2.evil.com it is a command and control server'"
    $rule2 = $null
    try {
        $body = @{
            prompt = 'Block malware-c2.evil.com it is a command and control server'
        } | ConvertTo-Json

        $rule2 = Invoke-RestMethod "$BackendUrl/api/generate-rule" `
            -Method POST `
            -Body $body `
            -ContentType 'application/json' `
            -TimeoutSec 30 `
            -ErrorAction Stop
    }
    catch {
        Write-Host "           Error: $($_.Exception.Message)" -ForegroundColor Red
    }

    Assert-NotNull $rule2 "POST /api/generate-rule returns a response"
    Assert-True ($rule2.success -eq $true) "Response indicates success"
    Assert-True ($rule2.rule.type -eq 'domain') "Rule type is 'domain' (got: $($rule2.rule.type))"
    Assert-True ($rule2.rule.target -match 'evil\.com') "Rule target contains 'evil.com' (got: $($rule2.rule.target))"
    Assert-True ($rule2.rule.action -eq 'block') "Rule action is 'block' (got: $($rule2.rule.action))"
    Write-Detail "Reason: $($rule2.rule.reason)"

    # --- Step 2.3: Analyze log context ---
    Write-Host ""
    Write-Host "  Step 2.3: Generate Rule -- With Log Context" -ForegroundColor Yellow
    Write-Detail "Sending simulated brute-force log data for AI analysis"
    $rule3 = $null
    try {
        $logContext = @"
[
  {"timestamp":"2026-02-25T08:00:01Z","src_ip":"203.0.113.42","dst_port":22,"action":"block","reason":"SSH brute force","attempts":150},
  {"timestamp":"2026-02-25T08:00:02Z","src_ip":"203.0.113.42","dst_port":22,"action":"block","reason":"SSH brute force","attempts":200},
  {"timestamp":"2026-02-25T08:00:03Z","src_ip":"203.0.113.42","dst_port":22,"action":"block","reason":"SSH brute force","attempts":350}
]
"@
        $body = @{
            prompt      = 'Analyze these firewall logs and generate a rule to stop the attack'
            contextData = $logContext
        } | ConvertTo-Json

        $rule3 = Invoke-RestMethod "$BackendUrl/api/generate-rule" `
            -Method POST `
            -Body $body `
            -ContentType 'application/json' `
            -TimeoutSec 30 `
            -ErrorAction Stop
    }
    catch {
        Write-Host "           Error: $($_.Exception.Message)" -ForegroundColor Red
    }

    Assert-NotNull $rule3 "POST /api/generate-rule (with context) returns a response"
    Assert-True ($rule3.success -eq $true) "Response indicates success"
    Assert-True ($rule3.rule.target -eq '203.0.113.42') "AI identified attacker IP '203.0.113.42' (got: $($rule3.rule.target))"
    Assert-True ($rule3.rule.action -eq 'block') "AI recommended 'block' action (got: $($rule3.rule.action))"
    Assert-True ($rule3.rule.confidence -ge 0.8) "High confidence >= 80% (got: $([math]::Round($rule3.rule.confidence * 100))%)"
    Write-Detail "Reason: $($rule3.rule.reason)"
    Write-Detail "Confidence: $([math]::Round($rule3.rule.confidence * 100))%"
    Write-Detail "Protocol: $($rule3.rule.protocol), Port: $($rule3.rule.port)"
}

# =============================================================================
# TEST CASE 3: Attack Detection & Response (End-to-End)
# =============================================================================
# Objective : Launch a real port scan from Kali, verify the backend detects
#             network activity, and confirm AI can generate a defense rule.
# Preconditions: Backend running, Kali SSH accessible, target reachable.
# Expected : Attack runs, logs are generated, AI produces a block rule.
# =============================================================================
function Run-Test3 {
    Write-TestHeader 3 "Attack Detection & Response (End-to-End)" `
        "Launches a real attack from Kali and validates the full defense pipeline."

    # --- Step 3.1: Verify Kali connectivity ---
    Write-Host "  Step 3.1: Kali VM Connectivity" -ForegroundColor Yellow
    $kaliOk = $false
    $kaliResult = ssh -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no "$KaliUser@$KaliHost" "echo ok" 2>$null
    if ($kaliResult -eq 'ok') { $kaliOk = $true }
    else {
        $ping = Test-Connection -ComputerName $KaliHost -Count 1 -Quiet -ErrorAction SilentlyContinue
        if ($ping) { $kaliOk = $true }
    }
    Assert-True $kaliOk "Kali VM ($KaliHost) is reachable"

    if (-not $kaliOk) {
        Write-Host "    [SKIP] Remaining steps skipped -- Kali unreachable" -ForegroundColor Yellow
        return
    }

    # --- Step 3.2: Verify attack tools installed ---
    Write-Host ""
    Write-Host "  Step 3.2: Attack Tools Verification" -ForegroundColor Yellow
    $nmapCheck = ssh -o StrictHostKeyChecking=no "$KaliUser@$KaliHost" 'which nmap' 2>$null
    Assert-True ($nmapCheck -match 'nmap') "nmap is installed on Kali"

    # --- Step 3.3: Capture pre-attack stats ---
    Write-Host ""
    Write-Host "  Step 3.3: Pre-Attack Baseline" -ForegroundColor Yellow
    $preStats = $null
    try {
        $preStats = Invoke-RestMethod "$BackendUrl/api/stats/realtime" -TimeoutSec 10 -ErrorAction Stop
    }
    catch {}
    Assert-NotNull $preStats "Captured pre-attack baseline stats"
    $preEventCount = $preStats.eventsProcessed
    Write-Detail "Events before attack: $preEventCount"

    # --- Step 3.4: Launch a quick nmap scan (30 seconds) ---
    Write-Host ""
    Write-Host "  Step 3.4: Launch Port Scan (nmap quick scan)" -ForegroundColor Yellow
    Write-Detail "Target: $Target (scanning top 100 ports, ~30 seconds)"

    $scanCmd = "nmap -T4 --top-ports 100 $Target -oN /tmp/test_scan.txt > /dev/null 2>&1; cat /tmp/test_scan.txt | head -5"
    $scanResult = ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$KaliUser@$KaliHost" $scanCmd 2>&1

    $scanCompleted = ($scanResult -match 'Nmap scan report' -or $scanResult -match 'PORT')
    Assert-True $scanCompleted "Nmap scan completed successfully"
    if ($scanResult) {
        $scanResult | Select-Object -First 3 | ForEach-Object { Write-Detail $_ }
    }

    # --- Step 3.5: Verify scan results exist on Kali ---
    Write-Host ""
    Write-Host "  Step 3.5: Scan Output Verification" -ForegroundColor Yellow
    $scanFile = ssh -o StrictHostKeyChecking=no "$KaliUser@$KaliHost" 'test -f /tmp/test_scan.txt && echo exists' 2>$null
    Assert-True ($scanFile -match 'exists') "Scan output file created on Kali"

    # Get open ports found
    $openPorts = ssh -o StrictHostKeyChecking=no "$KaliUser@$KaliHost" 'grep "open" /tmp/test_scan.txt 2>/dev/null | wc -l' 2>$null
    Write-Detail "Open ports found: $openPorts"

    # --- Step 3.6: AI Defense Response ---
    Write-Host ""
    Write-Host "  Step 3.6: AI Defense Rule Generation" -ForegroundColor Yellow
    Write-Detail "Asking AI to analyze the scan and generate a defense rule"

    $scanData = ssh -o StrictHostKeyChecking=no "$KaliUser@$KaliHost" 'cat /tmp/test_scan.txt 2>/dev/null' 2>$null
    $defenseRule = $null
    try {
        $body = @{
            prompt      = "A port scan was detected from $KaliHost against our firewall at $Target. Analyze and generate a block rule."
            contextData = ($scanData | Out-String)
        } | ConvertTo-Json

        $defenseRule = Invoke-RestMethod "$BackendUrl/api/generate-rule" `
            -Method POST `
            -Body $body `
            -ContentType 'application/json' `
            -TimeoutSec 30 `
            -ErrorAction Stop
    }
    catch {
        Write-Host "           Error: $($_.Exception.Message)" -ForegroundColor Red
    }

    Assert-NotNull $defenseRule "AI generated a defense rule from scan data"
    Assert-True ($defenseRule.success -eq $true) "AI response indicates success"
    Assert-True ($defenseRule.rule.action -eq 'block') "AI recommended blocking the attacker"
    Assert-True ($defenseRule.rule.target -eq $KaliHost) "AI identified correct attacker IP ($KaliHost)"
    Write-Detail "Rule: $($defenseRule.rule.action) $($defenseRule.rule.target) ($($defenseRule.rule.reason))"
    Write-Detail "Confidence: $([math]::Round($defenseRule.rule.confidence * 100))%"

    # --- Step 3.7: Cleanup ---
    Write-Host ""
    Write-Host "  Step 3.7: Cleanup" -ForegroundColor Yellow
    ssh -o StrictHostKeyChecking=no "$KaliUser@$KaliHost" 'rm -f /tmp/test_scan.txt' 2>$null
    Write-Host "    [OK] Test artifacts cleaned up" -ForegroundColor Green
}

# =============================================================================
# MAIN -- Run Tests
# =============================================================================
Write-Banner "FirewallAI -- Test Suite"
Write-Host "  Backend:  $BackendUrl" -ForegroundColor DarkGray
Write-Host "  Kali:     $KaliUser@$KaliHost" -ForegroundColor DarkGray
Write-Host "  Target:   $Target" -ForegroundColor DarkGray
Write-Host ""

$startTime = Get-Date

if ($TestNumber -eq 0 -or $TestNumber -eq 1) { Run-Test1 }
if ($TestNumber -eq 0 -or $TestNumber -eq 2) { Run-Test2 }
if ($TestNumber -eq 0 -or $TestNumber -eq 3) { Run-Test3 }

$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

# =============================================================================
# RESULTS SUMMARY
# =============================================================================
Write-Host ""
Write-Host ""
Write-Banner "TEST RESULTS SUMMARY"

Write-Host "  Total Assertions:  $($totalPass + $totalFail)" -ForegroundColor White
Write-Host "  Passed:            $totalPass" -ForegroundColor Green
Write-Host "  Failed:            $totalFail" -ForegroundColor $(if ($totalFail -gt 0) { 'Red' } else { 'Green' })
Write-Host "  Duration:          $([math]::Round($duration, 1)) seconds" -ForegroundColor Gray
Write-Host ""

if ($totalFail -eq 0) {
    Write-Host "  +--------------------------------------------+" -ForegroundColor Green
    Write-Host "  |     ALL TESTS PASSED -- SYSTEM HEALTHY     |" -ForegroundColor Green
    Write-Host "  +--------------------------------------------+" -ForegroundColor Green
}
else {
    Write-Host "  +--------------------------------------------+" -ForegroundColor Red
    Write-Host "  |     SOME TESTS FAILED -- CHECK OUTPUT      |" -ForegroundColor Red
    Write-Host "  +--------------------------------------------+" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Failed steps:" -ForegroundColor Red
    $testResults | Where-Object { $_.Result -eq 'FAIL' } | ForEach-Object {
        Write-Host "    - $($_.Step)" -ForegroundColor Red
    }
}

Write-Host ""
