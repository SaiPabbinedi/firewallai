# FirewallAI - Test Cases & System Workflow
## Project Flow and User Interaction Guide

---

## System Architecture Overview

```
+------------------+          +-------------------+         +------------------+
|   WINDOWS VM     |          |    UBUNTU VM      |         |    KALI VM       |
|   (Dashboard)    |          |    (Backend)      |         |   (Attacker)     |
|                  |          |                   |         |                  |
|  React Frontend  |  REST    |  Node.js Backend  |         |  Attack Scripts  |
|  (localhost:5173) | ------> |  (port 3001)      |         |  (nmap, hydra,   |
|                  |          |                   |         |   hping3, nikto) |
|  User opens      |          |  Groq/Ollama AI   |         |                  |
|  browser here    |          |  Engine           |         |  Launches attacks|
+--------+---------+          +--------+----------+         +--------+---------+
         |                             |                             |
         |         +-------------------+-------------------+         |
         |         |          pfSENSE FIREWALL             |         |
         +-------->|          (192.168.1.1)                |<--------+
                   |                                       |
                   |  - Monitors all network traffic       |
                   |  - Generates firewall logs            |
                   |  - AI rules are applied here          |
                   |  - Blocks malicious IPs/domains       |
                   +---------------------------------------+
```

---

## Test Case 1: System Health Verification
**Objective:** Verify all system components are running and communicating

### User Actions & System Response

```
STEP 1: User starts the system from Windows
+------------------------------------------------------------------+
|  User Action:                                                     |
|  > Opens PowerShell                                               |
|  > Runs: .\Run-FirewallAI.ps1 -Action start                      |
+------------------------------------------------------------------+
         |
         v
+------------------------------------------------------------------+
|  System Response:                                                 |
|  Script SSHes into Ubuntu VM (192.168.1.101)                     |
|  Executes start_all.sh which starts:                              |
|    1. Elasticsearch (log storage)                                 |
|    2. Kafka (real-time streaming)                                 |
|    3. Grafana (monitoring dashboards)                             |
|    4. Node.js Backend (API + AI engine)                           |
|    5. Spark Defense Engine (ML-based detection)                   |
|    6. Data Connectors (log pipeline)                              |
+------------------------------------------------------------------+
         |
         v
+------------------------------------------------------------------+
|  User Action:                                                     |
|  > Runs: .\Run-FirewallAI.ps1 -Action status                     |
+------------------------------------------------------------------+
         |
         v
+------------------------------------------------------------------+
|  Expected Output:                                                 |
|                                                                   |
|  +============================================================+  |
|  |  FirewallAI -- System Status                                |  |
|  +============================================================+  |
|                                                                   |
|    -- Ubuntu Server (192.168.1.101) --                            |
|    [OK] elasticsearch -- Running                                  |
|    [OK] grafana-server -- Running                                 |
|    [OK] server_v2.js -- Running (PID: 1234)                       |
|    [OK] Backend API -- HEALTHY (http://192.168.1.101:3001)        |
|         Version: 2.1.0                                            |
|         AI: groq (llama-3.3-70b-versatile)                        |
|                                                                   |
|    -- Kali Linux (192.168.1.103) --                               |
|    [OK] Attack scripts present                                    |
|                                                                   |
|    -- Windows (This Machine) --                                   |
|    [OK] React dev server -- Running                               |
+------------------------------------------------------------------+

PASS CRITERIA:
  [x] All services show [OK] status
  [x] Backend API returns HEALTHY
  [x] AI provider is initialized (groq or ollama)
  [x] Both VMs are reachable via SSH
```

---

## Test Case 2: AI-Powered Rule Generation
**Objective:** Demonstrate the AI engine analyzing threats and generating firewall rules

### Flow Diagram

```
User types natural           AI Engine               Generated
language request             analyzes                 firewall rule
      |                         |                         |
      v                         v                         v

"Block IP 10.0.0.55    -->  Groq LLaMA 3.3     -->  {
 it is doing port           processes the            type: "ip",
 scanning"                  request                  target: "10.0.0.55",
                                                     action: "block",
                                                     protocol: "any",
                                                     reason: "Port scanning
                                                              detected",
                                                     confidence: 0.95
                                                    }
```

### User Interaction Steps

```
STEP 1: User opens the dashboard
+------------------------------------------------------------------+
|  User Action:                                                     |
|  > Opens browser: http://localhost:5173                           |
|  > Navigates to "AI Insights" page                                |
+------------------------------------------------------------------+
         |
         v
+------------------------------------------------------------------+
|  What user sees on Dashboard:                                     |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  AI Firewall Rule Generator                                 |  |
|  |                                                             |  |
|  |  Enter your request:                                        |  |
|  |  +-------------------------------------------------------+ |  |
|  |  | Block the IP 10.0.0.55 it is doing port scanning       | |  |
|  |  +-------------------------------------------------------+ |  |
|  |                                                             |  |
|  |  [Generate Rule]                                            |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
         |
         v
STEP 2: User clicks "Generate Rule"
+------------------------------------------------------------------+
|  Behind the scenes:                                               |
|                                                                   |
|  Browser ---POST /api/generate-rule---> Ubuntu Backend            |
|    { prompt: "Block IP 10.0.0.55..." }                            |
|                                                                   |
|  Backend ---API call---> Groq Cloud AI (LLaMA 3.3 70B)           |
|    System prompt + user request                                   |
|                                                                   |
|  Groq AI ---response---> Backend                                  |
|    { type: "ip", target: "10.0.0.55", action: "block", ... }     |
|                                                                   |
|  Backend ---JSON response---> Browser                             |
+------------------------------------------------------------------+
         |
         v
STEP 3: User sees the generated rule
+------------------------------------------------------------------+
|  What user sees:                                                  |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  Generated Rule:                                            |  |
|  |                                                             |  |
|  |  Action:     BLOCK                                          |  |
|  |  Type:       IP Address                                     |  |
|  |  Target:     10.0.0.55                                      |  |
|  |  Protocol:   any                                            |  |
|  |  Interface:  WAN + LAN                                      |  |
|  |  Confidence: 95%                                            |  |
|  |  Reason:     Port scanning activity detected from this IP   |  |
|  |                                                             |  |
|  |  [Approve & Apply Rule]    [Reject]                         |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
         |
         v
STEP 4: User clicks "Approve & Apply Rule"
+------------------------------------------------------------------+
|  Behind the scenes:                                               |
|                                                                   |
|  Browser ---POST /api/apply-rule---> Ubuntu Backend               |
|    { rule: {...}, approved: true }                                 |
|                                                                   |
|  Backend ---SSH---> pfSense Firewall (192.168.1.1)               |
|    > easyrule block wan 10.0.0.55                                 |
|    > easyrule block lan 10.0.0.55                                 |
|    > pfctl -k 10.0.0.55  (kill existing connections)             |
|                                                                   |
|  Backend logs the action to audit trail                           |
+------------------------------------------------------------------+
         |
         v
+------------------------------------------------------------------+
|  What user sees:                                                  |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  [SUCCESS] Rule applied to pfSense firewall!                |  |
|  |  IP 10.0.0.55 is now BLOCKED on WAN and LAN interfaces     |  |
|  |  All existing connections terminated                        |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+

PASS CRITERIA:
  [x] AI generates a valid rule from natural language
  [x] Rule contains correct IP, action, and reason
  [x] Confidence score is reasonable (> 80%)
  [x] Rule is successfully applied to pfSense
  [x] Audit log records the action
```

### Test Case 2B: AI Analyzes Attack Logs

```
STEP 1: User provides log data for AI analysis
+------------------------------------------------------------------+
|  User Action:                                                     |
|  > Dashboard shows recent firewall logs:                          |
|                                                                   |
|    TIME         SOURCE IP       PORT  ACTION  DETAILS             |
|    08:00:01     203.0.113.42    22    BLOCK   SSH brute force     |
|    08:00:02     203.0.113.42    22    BLOCK   SSH brute force     |
|    08:00:03     203.0.113.42    22    BLOCK   SSH brute force     |
|    ... (350+ attempts in 3 seconds)                               |
|                                                                   |
|  > User clicks "Analyze with AI" on these logs                    |
+------------------------------------------------------------------+
         |
         v
+------------------------------------------------------------------+
|  AI Analysis Result:                                              |
|                                                                   |
|  Threat Analysis:                                                 |
|    Attacker: 203.0.113.42                                         |
|    Attack Type: SSH Brute Force                                   |
|    Severity: HIGH                                                 |
|    350+ login attempts in 3 seconds                               |
|                                                                   |
|  Recommended Rule:                                                |
|    Action: BLOCK                                                  |
|    Target: 203.0.113.42                                           |
|    Confidence: 97%                                                |
|    Reason: Automated SSH brute force attack detected              |
|                                                                   |
|  [Apply Rule]  [Dismiss]                                          |
+------------------------------------------------------------------+

PASS CRITERIA:
  [x] AI correctly identifies the attacker IP from log data
  [x] AI classifies the attack type (brute force)
  [x] Confidence is high (> 90%) for obvious attacks
  [x] Generated rule targets the correct IP
```

---

## Test Case 3: End-to-End Attack Detection & Defense
**Objective:** Full lifecycle -- attack launch, detection, AI analysis, automated defense

### Complete Flow Diagram

```
   KALI VM                   pfSENSE              UBUNTU VM              WINDOWS VM
  (Attacker)                (Firewall)            (Backend)              (Dashboard)
      |                         |                      |                      |
      |   1. Port Scan          |                      |                      |
      |------------------------>|                      |                      |
      |   nmap scans all ports  |                      |                      |
      |                         |                      |                      |
      |                         |  2. Generates logs   |                      |
      |                         |--------------------->|                      |
      |                         |  Firewall log entry  |                      |
      |                         |                      |                      |
      |                         |                      |  3. Real-time update |
      |                         |                      |--------------------->|
      |                         |                      |  WebSocket push      |
      |                         |                      |                      |
      |                         |                      |               4. Dashboard shows
      |                         |                      |               threat alert with
      |                         |                      |               attacker details
      |                         |                      |                      |
      |                         |                      |  5. User clicks      |
      |                         |                      |  "Generate Rule"     |
      |                         |                      |<---------------------|
      |                         |                      |                      |
      |                         |                      |  6. AI generates     |
      |                         |                      |  block rule for      |
      |                         |                      |  Kali's IP           |
      |                         |                      |                      |
      |                         |                      |  7. User approves    |
      |                         |                      |<---------------------|
      |                         |                      |                      |
      |                         |  8. SSH: Apply rule  |                      |
      |                         |<---------------------|                      |
      |                         |  easyrule block      |                      |
      |                         |  192.168.1.103       |                      |
      |                         |                      |                      |
      |  9. BLOCKED!            |                      |                      |
      |   X X X X X X X X X    |                      |                      |
      |  Connection refused     |                      |                      |
      |                         |                      |               10. Dashboard shows
      |                         |                      |               "Rule Applied
      |                         |                      |                Successfully"
```

### Step-by-Step User Experience

```
PHASE 1: ATTACK LAUNCH (from Windows PowerShell)
=================================================================

User Action:
  > .\Demo-Attack.ps1
  > Selects option [1] Full Attack Suite

What happens:
  - Script SSHes into Kali VM
  - Clears any previous attack logs
  - Launches run_full_test.sh in background
  - Attack runs in 4 phases:

  Phase 1: PORT SCANNING (nmap)
  +----------------------------------------------------------+
  |  Kali runs: nmap -sS -sV -O 192.168.1.1                 |
  |  Scans all 65,535 ports on pfSense firewall              |
  |  Duration: ~5 minutes                                    |
  +----------------------------------------------------------+

  Phase 2: BRUTE FORCE (hydra)
  +----------------------------------------------------------+
  |  Kali runs: hydra -l admin -P passwords.txt ssh://target |
  |  Attempts thousands of SSH login combinations            |
  |  Duration: ~5 minutes                                    |
  +----------------------------------------------------------+

  Phase 3: WEB ATTACKS (nikto + gobuster)
  +----------------------------------------------------------+
  |  Kali runs: nikto -h http://192.168.1.1                  |
  |  Tries SQL injection, XSS, directory traversal           |
  |  Duration: ~5 minutes                                    |
  +----------------------------------------------------------+

  Phase 4: DDoS SIMULATION (hping3)
  +----------------------------------------------------------+
  |  Kali runs: hping3 --flood -S -p 80 192.168.1.1         |
  |  Floods the firewall with SYN packets                    |
  |  Duration: ~5 minutes                                    |
  +----------------------------------------------------------+


PHASE 2: DETECTION (on Dashboard)
=================================================================

User Action:
  > Switches to browser: http://localhost:5173

What user sees on Dashboard:
  +----------------------------------------------------------+
  |  FIREWALLAI DASHBOARD                                     |
  |                                                           |
  |  +-----------------------------------------------------+ |
  |  |  THREAT MAP                                          | |
  |  |                                                      | |
  |  |  [!] Active threats detected: 3                      | |
  |  |                                                      | |
  |  |  192.168.1.103 (Kali) ----attack----> 192.168.1.1    | |
  |  |                                                      | |
  |  |  Attack Type: Port Scanning                          | |
  |  |  Packets: 12,450                                     | |
  |  |  Duration: 3 min 22 sec                              | |
  |  +-----------------------------------------------------+ |
  |                                                           |
  |  +-----------------------------------------------------+ |
  |  |  TRAFFIC OVERVIEW                                    | |
  |  |                                                      | |
  |  |  Events/sec: [graph showing spike] ^^^^              | |
  |  |  Blocked:    847                                     | |
  |  |  Allowed:    1,203                                   | |
  |  |  Protocols:  TCP 78% | UDP 15% | ICMP 7%            | |
  |  +-----------------------------------------------------+ |
  |                                                           |
  |  +-----------------------------------------------------+ |
  |  |  AI INSIGHTS                                         | |
  |  |                                                      | |
  |  |  [!] HIGH: Port scan detected from 192.168.1.103     | |
  |  |  [!] MEDIUM: Unusual SSH traffic pattern             | |
  |  |                                                      | |
  |  |  [Generate Defense Rule]                             | |
  |  +-----------------------------------------------------+ |
  +----------------------------------------------------------+


PHASE 3: AI DEFENSE (User Action)
=================================================================

User Action:
  > Clicks "Generate Defense Rule"
  > AI analyzes the attack pattern

System Response:
  +----------------------------------------------------------+
  |  AI ANALYSIS RESULT                                       |
  |                                                           |
  |  Threat Summary:                                          |
  |    Source:      192.168.1.103 (Kali Linux)                |
  |    Attack:      Multi-phase attack (scan + brute force)   |
  |    Severity:    CRITICAL                                  |
  |    Risk Score:  9.2 / 10                                  |
  |                                                           |
  |  Recommended Action:                                      |
  |    +--------------------------------------------------+   |
  |    |  BLOCK 192.168.1.103 on WAN and LAN             |   |
  |    |  Protocol: ALL                                   |   |
  |    |  Confidence: 97%                                 |   |
  |    |  Reason: Coordinated multi-vector attack         |   |
  |    +--------------------------------------------------+   |
  |                                                           |
  |  [Approve & Apply]     [Modify]     [Reject]             |
  +----------------------------------------------------------+

User Action:
  > Clicks "Approve & Apply"

System Response:
  Backend SSHes into pfSense:
    > easyrule block wan 192.168.1.103
    > easyrule block lan 192.168.1.103
    > pfctl -k 192.168.1.103

Result:
  +----------------------------------------------------------+
  |  [SUCCESS] Firewall rule applied!                         |
  |                                                           |
  |  192.168.1.103 is now BLOCKED                             |
  |  All active connections terminated                        |
  |  Audit log entry created                                  |
  +----------------------------------------------------------+


PHASE 4: VERIFICATION
=================================================================

What happens after blocking:
  - Kali's attacks can no longer reach pfSense
  - Dashboard shows attack traffic dropping to zero
  - Audit log records: who approved, when, what rule
  - pfSense firewall rules page shows the new block rule

User can verify:
  > .\Run-FirewallAI.ps1 -Action status
  Shows: "Attack simulation -- Not running (blocked)"


PHASE 5: RESET FOR RE-DEMO (Optional)
=================================================================

User Action:
  > .\Demo-Attack.ps1
  > Selects option [U] Unblock Kali from pfSense
  > Selects option [C] Clear logs and reset
  > Selects option [1] Run attack again

The entire cycle repeats!
```

---

## Summary: User Interaction Points

| Step | User Action | System Response |
|------|------------|-----------------|
| 1 | Runs start script from PowerShell | Backend + services start on Ubuntu |
| 2 | Opens dashboard in browser | Sees real-time traffic overview |
| 3 | Runs attack script | Kali launches attacks against pfSense |
| 4 | Views dashboard | Sees threat alerts, traffic spikes |
| 5 | Clicks "Generate Rule" | AI analyzes attack and suggests block rule |
| 6 | Reviews and approves rule | Rule is applied to pfSense firewall |
| 7 | Verifies block | Attack traffic stops, attacker is blocked |
| 8 | Optionally unblocks | Can repeat the entire demo cycle |

---

## Key Innovation Points (for Presentation)

1. **Natural Language to Firewall Rules**: Users describe threats in plain English, AI converts to technical firewall rules
2. **Real-Time Detection**: Live traffic analysis with instant threat alerts
3. **Human-in-the-Loop**: AI suggests rules, but humans approve before applying (safety)
4. **Confidence Scoring**: AI provides confidence levels so users can make informed decisions
5. **Audit Trail**: Every action is logged for compliance and accountability
6. **Multi-Vector Defense**: Handles port scans, brute force, web attacks, and DDoS
7. **Automated but Safe**: High-confidence threats can be auto-blocked, lower ones require approval
