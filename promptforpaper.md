# FirewallAI — Comprehensive Project Context Prompt

> **Purpose:** This document is a self-contained context prompt designed to enable an AI agent to rapidly understand the FirewallAI project in its entirety — its architecture, system design, VM topology, networking, data pipelines, ML/AI integration, testing methodology, deployment workflows, user interaction model, and research significance. Use this as the primary reference when generating a research paper, documentation, or performing further analysis.

---

## 1. Project Identity & Research Thesis

**Project Name:** Adaptive Network Defense System (FirewallAI)  
**Version:** 2.1.0  
**License:** MIT  
**Repository:** [github.com/SaiPabbinedi/firewallai](https://github.com/SaiPabbinedi/firewallai)

**Research Thesis:**  
FirewallAI is a **hybrid framework integrating Big Data Streams and Generative AI for autonomous firewall management.** It demonstrates that combining Apache Kafka-based real-time log streaming, dual-model Machine Learning (Isolation Forest + Random Forest), and Large Language Model (LLM)-based natural language threat analysis can achieve **sub-3-second automated threat response** with **91% anomaly detection accuracy** — fully autonomous from log ingestion to firewall rule application on a live pfSense firewall.

**Core Innovation:**  
Unlike traditional SIEM tools that require manual rule creation, FirewallAI closes the entire detection-to-response loop autonomously: raw syslog → Kafka streaming → ML anomaly detection → LLM threat analysis → firewall rule generation → SSH-based pfSense rule application — with a human-in-the-loop approval gate for low-confidence decisions.

---

## 2. System Architecture — Multi-VM Topology

The system operates across a **3-VM + 1-appliance topology** that mirrors a real-world Security Operations Center (SOC) environment:

### 2.1 Virtual Machine Layout

| VM / Device | OS | IP Address | Role | Key Services |
|---|---|---|---|---|
| **Windows Host** | Windows 10/11 | 192.168.1.100 | Frontend Dashboard + Operator Station | React (Vite), PowerShell Launcher |
| **Ubuntu Server** | Ubuntu 22.04 LTS | 192.168.1.101 | Backend, Analytics, Data Pipeline | Node.js API, Kafka, Elasticsearch, Spark, Grafana, Ollama |
| **pfSense Firewall** | FreeBSD (pfSense 2.7+) | 192.168.1.1 | Network Perimeter Firewall + IDS | pfSense, Suricata IDS/IPS, pfBlockerNG, Unbound DNS |
| **Kali Linux** | Kali 2024.x | 192.168.1.103 | Adversary Simulation (Red Team) | nmap, hydra, hping3, automated attack scripts |

### 2.2 Network Architecture

```
Internet
   │
   ▼
┌──────────────┐
│   pfSense    │ ◄── WAN Gateway (192.168.1.1)
│  + Suricata  │     Generates: filterlog, Suricata EVE JSON, DNS logs
│  + pfBlockerNG│     Receives: SSH commands for rule application
└──────┬───────┘
       │ LAN (192.168.1.0/24)
       ├───── Windows Host (192.168.1.100) — React Dashboard
       ├───── Ubuntu Server (192.168.1.101)  — Backend + Analytics
       └───── Kali Linux   (192.168.1.103)  — Attack Simulation
```

### 2.3 Data Flow Architecture (End-to-End)

```
COLLECTION LAYER                  STREAMING LAYER                  ANALYTICS LAYER                 ACTION LAYER
─────────────────                 ────────────────                 ───────────────                 ────────────

pfSense filterlog ─┐              ┌─ firewall-logs ──┐             ┌─ Isolation Forest ──┐         ┌─ pfSense easyrule
Suricata EVE JSON ─┼─► UDP:514 ──►│  Apache Kafka    │──► Spark ──►│  Random Forest     │──► LLM ─►│  pfBlockerNG DNSBL
DNS Logs (Unbound)─┘   (syslog)   │  (7 topics)      │   Streaming │  Threat Aggregator │  Analysis│  State table clear
                       │          └──────────────────┘             └────────────────────┘         └──────────────────
                       ▼                    │
                  udp_to_kafka_v2.py        ├─► kafka_to_elasticsearch.py ──► Elasticsearch
                  (parses, enriches,        │                                    │
                   routes by topic)         └─► realtime-metrics ──────────► Node.js Backend ──► React Dashboard
                                                                                                    │
                                                                                              Grafana (embedded)
```

---

## 3. Technology Stack — Complete Inventory

### 3.1 Frontend (Windows Host)

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.3 | UI Framework |
| **Vite** | 6.3 | Build Tool & Dev Server |
| **TypeScript** | 5.4 | Type Safety |
| **Tailwind CSS** | 4.1 | Utility-first Styling |
| **Radix UI** | Various | 33 headless UI primitives (Dialog, Tabs, Select, etc.) |
| **Recharts** | 2.15 | Data visualization (charts, graphs) |
| **React Flow** (@xyflow/react) | 12.10 | Interactive Network Topology visualization |
| **React Simple Maps** | 3.0 | Geospatial Threat Map (world map) |
| **Framer Motion** | 12.29 | Animations and transitions |
| **xterm.js** | 6.0 | In-browser SSH terminal emulation |
| **Socket.IO Client** | 4.8 | Real-time WebSocket communication |
| **Lucide React** | 0.487 | Icon library |
| **Sonner** | 2.0 | Toast notifications |

### 3.2 Backend (Ubuntu Server — Node.js API)

| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | 18+ | Runtime |
| **Express** | 4.18 | HTTP API framework |
| **Socket.IO** | 4.7 | WebSocket server (terminal, real-time stats) |
| **node-pty** | 1.0 | Pseudo-terminal for SSH shell sessions |
| **node-ssh** | 13.2 | SSH client for pfSense command execution |
| **KafkaJS** | 2.2 (optional) | Kafka producer/consumer |
| **Groq SDK** | Latest (optional) | Cloud LLM API (Groq — LLaMA 3.3 70B) |
| **Axios** | 1.6 | HTTP client for Ollama/ES communication |
| **CORS** | 2.8 | Cross-origin security |

### 3.3 Analytics Engine (Ubuntu Server — Python/Spark)

| Technology | Version | Purpose |
|---|---|---|
| **Apache Spark** | 3.5 | Structured Streaming for real-time log processing |
| **PySpark** | 3.5 | Python Spark API |
| **scikit-learn** | Latest | ML models (Isolation Forest, Random Forest) |
| **NumPy / Pandas** | Latest | Data manipulation and feature engineering |
| **kafka-python** | Latest | Kafka producer for metrics output |
| **geoip2** | Latest | MaxMind GeoLite2 IP geolocation |
| **Requests** | Latest | HTTP client for Ollama and AlienVault OTX API |

### 3.4 Data Infrastructure (Ubuntu Server)

| Technology | Version | Purpose |
|---|---|---|
| **Apache Kafka** | 3.9 | Real-time event streaming (7 topics) |
| **Apache ZooKeeper** | (bundled) | Kafka coordination |
| **Elasticsearch** | 8.x | Log storage, search, aggregations |
| **Grafana** | 10.2 | Monitoring dashboards (5 dashboards) |
| **InfluxDB** | 2.7 | Time-series metrics (via Docker) |
| **Ollama** | Latest | Local LLM inference (LLaMA 3.2:3b) |

### 3.5 Network Security (pfSense Appliance)

| Technology | Purpose |
|---|---|
| **pfSense 2.7+** | Stateful firewall, NAT, VPN |
| **Suricata IDS/IPS** | Signature-based intrusion detection (EVE JSON output) |
| **pfBlockerNG** | DNS blocklisting (DNSBL), IP blocklisting |
| **Unbound DNS** | DNS resolver with query logging |
| **pf (Packet Filter)** | BSD kernel-level firewall (manipulated via `easyrule` and `pfctl`) |

---

## 4. Core Software Components — Detailed Breakdown

### 4.1 `udp_to_kafka_v2.py` — Log Collection Bridge (283 lines)

**Purpose:** Receives raw syslog messages from pfSense/Suricata via **UDP port 514** and routes them to the correct Kafka topic.

**Key Behaviors:**
- Listens on `0.0.0.0:514` (requires root/sudo for privileged port)
- Parses pfSense `filterlog` format using regex (extracts: rule, action, interface, protocol, src/dst IP, ports)
- Parses Suricata EVE JSON format
- Routes messages to topics based on content: `filterlog → firewall-logs`, `suricata → suricata-alerts`, `named → dns-queries`
- Enriches messages with metadata (UUID, geo hash, ingestion timestamp)
- Tracks statistics: received, processed, errors, by-topic counts
- Handles graceful shutdown via SIGINT/SIGTERM
- Retry logic for Kafka connection with 30-second backoff

### 4.2 `defense_engine_v2.py` — ML Analytics Engine (1,141 lines)

**Purpose:** The core analytics brain. Runs Apache Spark Structured Streaming + ML models + LLM analysis in a unified pipeline.

**Key Classes:**

| Class | Lines | Responsibility |
|---|---|---|
| `MetricsTracker` | 133–258 | Thread-safe sliding window metrics (anomalies, LLM latency, MTTR, rules generated, EPS). Publishes snapshots every 15 seconds. |
| `MLModelManager` | 264–350 | Manages Isolation Forest (anomaly detection) and Random Forest (threat classification). Trains on synthetic baselines at startup, then adapts to live data. Includes `_heuristic_classify()` fallback. |
| `GemmaAnalyzer` | 356–495 | LLM integration via Ollama API. Generates structured JSON threat assessments and firewall rule recommendations. Falls back to rule-based analysis when LLM is unavailable. |
| `ThreatAggregator` | 501–604 | Aggregates per-IP statistics in sliding windows (packet counts, blocked counts, port diversity, protocols, timestamps). Extracts 6-dimensional feature vectors for ML input. Includes memory cleanup for old entries (30-minute TTL). |
| `ElasticsearchPublisher` | 610–659 | Direct ES publisher (single + bulk API) as fallback when Kafka is unavailable. |
| `ThreatIntelEnricher` | 665–753 | **Zero-RAM enrichment:** MaxMind GeoLite2 flat-file for IP geolocation, AlienVault OTX API for IP reputation (with 1-hour TTL cache), MITRE ATT&CK technique mapping (in-memory dict). |
| `DefenseEngine` | 759–1121 | Main orchestrator. Initializes all components, starts Spark streams (firewall-logs, suricata-alerts), runs ML analysis loop (30-second intervals), publishes metrics snapshots, and manages graceful shutdown. |

**ML Feature Vector (6 dimensions):**
```python
[packet_count, blocked_count, unique_ports, unique_destinations, block_ratio, time_span]
```

**Threat Classification Categories:**
- `port_scan` → MITRE T1046 (Network Service Discovery)
- `brute_force` → MITRE T1110 (Brute Force)  
- `ddos` → MITRE T1498 (Network Denial of Service)
- `web_attack` → MITRE T1190 (Exploit Public-Facing Application)
- `dns_tunnel` → MITRE T1071.004 (DNS Tunneling)
- `suspicious` → MITRE T1071 (Application Layer Protocol)

**Spark Streaming Configuration:**
- Window Duration: 5 minutes
- Sliding Interval: 1 minute
- Watermark: 10 minutes (firewall), 5 minutes (Suricata)
- Processing Trigger: 30 seconds (firewall), 10 seconds (Suricata)
- Checkpoint: `/tmp/spark_checkpoint`

### 4.3 `server_v2.js` — Backend API Server (1,353 lines)

**Purpose:** Node.js/Express API server with dual AI provider support, pfSense SSH integration, Elasticsearch querying, real-time stats, and WebSocket terminal.

**Key Features:**

| Feature | Implementation |
|---|---|
| **Dual AI Providers** | Runtime switchable between Groq (cloud, LLaMA 3.3 70B) and Ollama (local, LLaMA 3.2:3b). Auto-detects based on `GROQ_API_KEY` presence. |
| **AI Rule Generation** | Natural language prompt → structured JSON firewall rule. System prompt forces JSON-only output with type, target, action, interface, protocol, port, reason, confidence fields. |
| **pfSense SSH Integration** | Executes `easyrule` (IP blocking), `pfctl` (state killing), and `pfBlockerNG` commands via SSH. Input sanitization strips shell metacharacters and validates IP/domain format. |
| **Confidence-Based Approval** | Rules with confidence ≥ 0.9 auto-apply. Below threshold → `pending_approval` status requiring manual admin approval via the UI. |
| **Elasticsearch Integration** | Full-text search (`/api/logs/search`), aggregations (`/api/logs/aggregations`), threat summaries (`/api/threats/summary`), anomaly queries (`/api/threats/anomalies`), AI metrics snapshots (`/api/metrics/snapshot`). |
| **Graceful Degradation** | All ES endpoints fall back to mock data generators when Elasticsearch is offline. Dashboard always functional. |
| **Real-time Stats** | In-memory `Map()` tracks EPS, top sources, protocol distribution, action distribution, alerts, anomalies. Served via `/api/stats/realtime`. |
| **Audit Trail** | Every `apply-rule` operation logged to `audit_log.json` with timestamp, rule details, approval status, result. |
| **WebSocket Terminal** | Socket.IO + `node-pty` spawns interactive bash/powershell sessions. Multi-session management with unique terminal IDs. |
| **Blocklist Hosting** | Serves `ai_blocklist.txt` at `/ai.txt` — pfBlockerNG can point to this URL to consume AI-generated domain blocklists. |
| **CORS Restriction** | Whitelist-based CORS (localhost, 192.168.1.100, 192.168.1.101). Logs blocked origins. |

**API Endpoint Summary:**

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | System health, AI provider status, Kafka status |
| `GET` | `/api/ai/providers` | List available AI providers and models |
| `POST` | `/api/ai/switch` | Switch active AI provider (groq/ollama) |
| `POST` | `/api/generate-rule` | Generate firewall rule from natural language |
| `POST` | `/api/apply-rule` | Apply rule to pfSense via SSH |
| `GET` | `/api/audit-log` | Get audit trail (last 100 entries) |
| `GET` | `/api/approvals/pending` | Get rules pending approval |
| `POST` | `/api/approvals/:id/approve` | Approve a pending rule |
| `GET` | `/api/stats/realtime` | Real-time traffic statistics |
| `GET` | `/api/logs/search` | Search Elasticsearch logs |
| `GET` | `/api/logs/aggregations` | Traffic aggregations (by protocol, action, IP, time) |
| `GET` | `/api/threats/summary` | Threat intelligence summary |
| `GET` | `/api/threats/anomalies` | ML-detected anomalies |
| `GET` | `/api/metrics/snapshot` | AI/ML metrics for dashboard |
| `GET` | `/ai.txt` | Serve AI-generated blocklist for pfBlockerNG |

### 4.4 `kafka_to_elasticsearch.py` — Data Connector (312 lines)

**Purpose:** Streams data from Kafka topics to Elasticsearch indices with document transformation and bulk indexing.

**Key Classes:**
- `DocumentTransformer` — Routes and transforms messages per topic (firewall-logs → `firewall-events-*`, suricata-alerts → `suricata-alerts-*`, ai-analysis → `threat-sessions-*`, ai-metrics → `ai-metrics-*`)
- `KafkaElasticsearchConnector` — Buffered bulk indexing (configurable batch size and flush interval), retry logic, graceful shutdown

### 4.5 Frontend — React Dashboard (12 Pages)

| Page Component | Size | Key Features |
|---|---|---|
| `DashboardPage.tsx` | 18 KB | System overview cards, real-time event counters, protocol distribution chart, top sources chart, recent alerts list |
| `TerminalPage.tsx` | (in Terminal/) | Full xterm.js SSH terminal with multi-session management, tab-based UI, session persistence |
| `LogsPage.tsx` | 14 KB | Real-time log viewer with search, filtering by severity/protocol/action, auto-refresh, Elasticsearch-powered |
| `FirewallRulesPage.tsx` | 18 KB | AI rule generator (natural language input), rule preview with confidence indicator, apply/approve workflow, audit log viewer |
| `AnalyticsPage.tsx` | 16 KB | Traffic analysis charts (over time, by protocol, by action), top sources/destinations, Elasticsearch aggregation-powered |
| `ThreatMapPage.tsx` | 25 KB | Geospatial world map (React Simple Maps) showing attack origins with animated threat dots, country-level aggregation |
| `TopologyPage.tsx` | 22 KB | Interactive network topology (React Flow) showing device relationships, traffic flow, anomaly highlighting |
| `AIInsightsPage.tsx` | 20 KB | ML-detected anomalies, LLM threat analysis results, MITRE ATT&CK badge mapping, recommended rules |
| `AIMetricsPage.tsx` | 25 KB | Anomaly score distribution, LLM latency tracking, MTTR trends, detection accuracy, events-per-second gauge |
| `GrafanaPage.tsx` | 23 KB | Embedded Grafana dashboard with connection tester, kiosk mode toggle, configuration panel, persistent iframe (no reload on tab switch) |
| `SettingsPage.tsx` | 48 KB | System configuration, AI provider switching, connection testing, environment variable display, advanced settings |
| `LoginPage.tsx` | 5 KB | Authentication gate with demo credentials (admin/firewall123), session persistence via localStorage |

**UI Design System:**
- Dark theme with cyan (#00D9FF) accent color
- Glassmorphism effects on cards and panels
- Grid background pattern overlay
- Premium dark gradient palette
- 33 Radix UI primitives in `src/app/components/ui/`
- Recharts with consistent dark theming
- Framer Motion for page transitions and micro-animations
- Fixed sidebar (w-64) + fixed header layout

---

## 5. Apache Kafka — Streaming Configuration

### 5.1 Topics

| Topic | Partitions | Retention | Purpose | Producer | Consumer |
|---|---|---|---|---|---|
| `firewall-logs` | 12 | 7 days | pfSense filterlog entries | `udp_to_kafka_v2.py` | `defense_engine_v2.py` (Spark), `kafka_to_elasticsearch.py` |
| `suricata-alerts` | 6 | 14 days | Suricata EVE JSON alerts | `udp_to_kafka_v2.py` | `defense_engine_v2.py` (Spark), `kafka_to_elasticsearch.py` |
| `dns-queries` | 6 | 3 days | DNS resolution logs | `udp_to_kafka_v2.py` | `kafka_to_elasticsearch.py` |
| `threat-intel` | 3 | 30 days | Threat intelligence feeds | External feeds | `defense_engine_v2.py` |
| `ai-analysis` | 3 | 14 days | LLM analysis results | `defense_engine_v2.py` | `kafka_to_elasticsearch.py`, `server_v2.js` |
| `ai-metrics` | 3 | 14 days | ML/AI performance metrics | `defense_engine_v2.py` | `kafka_to_elasticsearch.py`, `server_v2.js` |
| `automation-audit` | 3 | 90 days | Rule change audit trail | `server_v2.js` | `kafka_to_elasticsearch.py` |
| `realtime-metrics` | 3 | 1 day | Dashboard real-time stats | `server_v2.js` | Frontend (via API polling) |

### 5.2 Kafka Configuration

- Broker: `localhost:9092` (single-node development)
- ZooKeeper: `localhost:2181`
- Heap: `-Xmx512M -Xms256M` (low-memory development profile)
- Replication Factor: 1 (single-node)

---

## 6. Elasticsearch — Index Architecture

| Index Pattern | Source | Key Fields | Purpose |
|---|---|---|---|
| `firewall-events-*` | Kafka (firewall-logs) | `@timestamp`, `action`, `protocol`, `src_ip`, `dst_ip`, `src_port`, `dst_port`, `interface`, `direction` | Raw firewall log storage and search |
| `suricata-alerts-*` | Kafka (suricata-alerts) | `@timestamp`, `event_type`, `src_ip`, `alert.signature`, `alert.category`, `alert.severity` | IDS alert storage |
| `threat-sessions-*` | Kafka (ai-analysis) | `@timestamp`, `session_id`, `src_ip`, `anomaly_score`, `threat_classification`, `threat_confidence`, `llm_analysis`, `mitre_technique`, `geo`, `otx_reputation`, `automated_action` | Enriched ML analysis results |
| `ai-metrics-*` | Kafka (ai-metrics) | `@timestamp`, `metric_type`, `anomaly_score`, `mttr_seconds`, `llm_latency_ms`, `events_per_second` | ML/AI performance metrics |

---

## 7. Machine Learning Pipeline — Design Details

### 7.1 Anomaly Detection (Isolation Forest)

- **Algorithm:** scikit-learn `IsolationForest`
- **Contamination:** 0.1 (10% of training data assumed anomalous)
- **Features:** 6-dimensional vector [packet_count, blocked_count, unique_ports, unique_destinations, block_ratio, time_span]
- **Training:** Initial synthetic baseline (1,000 samples), then adapts to live aggregated data
- **Output:** Anomaly score (continuous) + binary anomaly flag
- **Claimed Accuracy:** 91%

### 7.2 Threat Classification (Random Forest)

- **Algorithm:** scikit-learn `RandomForestClassifier`
- **Estimators:** 100 trees
- **Classes:** normal, port_scan, brute_force, ddos, web_attack
- **Training:** 400 synthetic labeled samples (200 normal + 50 per attack type)
- **Output:** Classification label + confidence score
- **Fallback:** `_heuristic_classify()` — rule-based classification using packet count, block ratio, port diversity, and time span thresholds

### 7.3 LLM Threat Analysis (Gemma/LLaMA via Ollama)

- **Provider 1 — Ollama (Local):** LLaMA 3.2:3b model, `temperature: 0.1`, 30-second timeout
- **Provider 2 — Groq (Cloud):** LLaMA 3.3 70B Versatile, `response_format: json_object`, 60-second timeout
- **Input:** Session data (source IP, packet count, blocked count, port diversity, anomaly score, ML classification)
- **Output:** Structured JSON — `{threat_level, attack_type, action, explanation, recommendation}`
- **Fallback:** Rule-based `_generate_fallback_analysis()` when LLM is unavailable

### 7.4 Threat Intelligence Enrichment

- **GeoIP:** MaxMind GeoLite2 City database (60MB flat-file, zero-RAM lookup) → lat, lng, country, city
- **IP Reputation:** AlienVault OTX API (free, cloud-based) → reputation score, pulse count, ASN, tags (1-hour TTL cache)
- **MITRE ATT&CK:** Static mapping dict → technique ID, name, tactic

---

## 8. Deployment & DevOps

### 8.1 Service Startup Order (Ubuntu)

The `start_all.sh` script starts services in strict dependency order:

```
1. Elasticsearch        (systemd)
2. ZooKeeper → Kafka    (systemd) + Topic creation
3. Grafana              (systemd) + Dashboard provisioning
4. Kafka-to-ES Connector (Python background process, PID tracked)
5. UDP-to-Kafka Bridge   (Python background process, requires sudo for port 514)
6. Node.js Backend       (Node.js background process)
7. Spark Defense Engine   (Python background process)
```

Each process is PID-tracked in `~/.pids/`, logged to `~/logs/`, and monitored by health checks.

### 8.2 Windows Launcher (`FirewallAI-Launcher.ps1`)

A professional-grade PowerShell launcher (399 lines) with:
- ASCII art banner
- Interactive menu (Full Stack, Frontend Only, Deploy Backend, Check Connection, Open Dashboard)
- Auto-downloads PuTTY SSH tools (plink.exe, pscp.exe) if missing
- SSH health check → Backend start on Ubuntu (via `screen` or `nohup` fallback) → Frontend start → Service readiness polling → Browser auto-open
- `.env.local` loading for credentials
- `-auto` flag for one-click headless operation

### 8.3 Docker Compose (Alternative Deployment)

`docker-compose.yml` provides containerized deployment for:
- Frontend (Vite dev server)
- Backend (Node.js)
- InfluxDB 2.7 (time-series)
- Grafana 10.2 (dashboards)
- Ollama (LLM with GPU passthrough)
- Telegraf 1.28 (metrics collection)
- Custom bridge network: `172.28.0.0/16`
- Health checks on all containers

### 8.4 Ubuntu Full Deployment Script (`deploy_ubuntu.sh`)

A self-contained 296-line bash script that:
1. Creates directory structure (`~/cyber-defense/{scripts,logs,models,data,config}`)
2. Installs system dependencies (Java 11, Python 3.10+, Node.js 18+)
3. Installs Python ML packages (pyspark, scikit-learn, pandas, numpy, kafka-python, elasticsearch)
4. Downloads + configures Apache Kafka 3.9
5. Downloads + configures Apache Spark 3.5
6. Creates Node.js backend with dependencies (express, cors, socket.io, kafkajs, node-pty, node-ssh, groq-sdk)
7. Installs Ollama + pulls LLaMA 3.2:3b model
8. Generates master startup/status scripts

### 8.5 Grafana Dashboards (5 Provisioned)

| Dashboard | File | Purpose |
|---|---|---|
| Traffic Overview | `traffic-overview.json` | Packet counts, protocol distribution, top talkers, traffic over time |
| Threat Detection | `threat-detection.json` | Severity heatmap, alert categories, attacker origins |
| Defense Automation | `defense-automation.json` | Auto-blocked IPs, rule generation rate, confidence distribution |
| Pipeline Health | `pipeline-health.json` | Kafka lag, ES indexing rate, service uptime |
| AI/ML Metrics | `ai-ml-metrics.json` | Anomaly score histogram, LLM latency, MTTR trends, model accuracy |

---

## 9. Testing — Adversary Simulation (Kali Linux)

### 9.1 Attack Scripts

| Script | Attack Type | Tools Used | Target |
|---|---|---|---|
| `port_scan.sh` | Network Reconnaissance | nmap (SYN, ACK, UDP, version, OS detect) | pfSense WAN/LAN |
| `brute_force_ssh.sh` | Credential Attack | hydra (SSH brute force) | pfSense SSH |
| `ddos_simulation.sh` | Volumetric Denial-of-Service | hping3 (SYN flood, UDP flood, ICMP flood) | pfSense port 80 |
| `web_attacks.sh` | Application-Layer Attacks | curl (SQL injection, XSS, path traversal, command injection payloads) | pfSense web interface |

### 9.2 Test Orchestrator (`run_full_test.sh`)

- Runs all 4 attack phases sequentially with configurable duration per phase (default: 5 minutes each)
- 30-second cooldown between phases
- Per-phase logging to `./logs/`
- Master log with timestamps
- Auto-termination if script exceeds duration limit
- Post-test validation checklist: check dashboard alerts, verify AI insights, review suggested rules, collect accuracy metrics

### 9.3 Expected Detection Performance

| Attack Type | Expected Detection Time | Detection Method |
|---|---|---|
| Port Scan | < 30 seconds | Suricata alert + ML anomaly (high port diversity) |
| SSH Brute Force | < 60 seconds | ML anomaly (high block ratio, single port) + LLM analysis |
| DDoS | < 10 seconds | ML anomaly (extreme packet volume, short time span) |
| SQLi / XSS | < 5 seconds | Suricata IDS signature match |

---

## 10. User Interaction Model

### 10.1 End User (Network Security Operator)

**Login:** Accesses `http://localhost:5173`, authenticates with credentials.

**Primary Workflows:**

1. **Monitoring** — Dashboard page shows real-time system health, event counts, protocol distribution, and top attack sources. Auto-refreshes.

2. **Log Investigation** — Logs page provides full-text search across Elasticsearch with time-range filtering, severity filtering, and export capability.

3. **AI-Assisted Rule Creation** — Operator types natural language prompt (e.g., "Block IP 10.0.0.5 for brute force") → AI generates structured rule → Operator reviews confidence score → Approves/Modifies → Rule applied to pfSense in real-time.

4. **Threat Analysis** — AI Insights page shows ML-detected anomalies enriched with MITRE ATT&CK mappings, GeoIP data, OTX reputation, and LLM-generated explanations.

5. **Topology & Geo Visualization** — Interactive network topology map shows device relationships and traffic flows. Geospatial threat map shows attack origins on a world map with animated indicators.

6. **Terminal Access** — Embedded xterm.js terminal provides SSH access to the Ubuntu backend server for advanced troubleshooting.

7. **Grafana Dashboards** — Embedded Grafana iframes (persistent, no reload on tab switch) for deep metric analysis.

### 10.2 Administrator

**Deployment:** Runs `FirewallAI-Launcher.ps1` (Windows) or `start_all.sh` (Ubuntu) for one-click startup.

**Configuration:** Manages `.env` files for credentials (pfSense SSH, Groq API key, Elasticsearch URL).

**AI Provider Management:** Switches between Groq (cloud) and Ollama (local) via Settings page or API.

**Approval Workflow:** Reviews and approves AI-generated rules below 90% confidence threshold.

---

## 11. Key Design Patterns & Innovations

| Pattern | Implementation | Benefit |
|---|---|---|
| **Graceful Degradation** | All services fall back to mock data when ES/Kafka/AI offline | Dashboard always functional for demos |
| **Dual AI Provider** | Runtime-switchable Groq (cloud) ↔ Ollama (local) | Works with or without internet access |
| **Confidence-Based Gating** | ≥ 90% auto-apply, < 90% requires human approval | Balances automation speed with safety |
| **Persistent Grafana** | Always-mounted iframe with CSS visibility toggle | No reload on tab switch (preserves state) |
| **Zero-RAM Enrichment** | MaxMind flat-file GeoIP + OTX API with TTL cache | Rich threat context without memory overhead |
| **MITRE ATT&CK Mapping** | Static dict mapping ML classifications to technique IDs | Industry-standard threat categorization |
| **Input Sanitization** | Shell metacharacter stripping + IP/domain regex validation | Prevents command injection via AI-generated rules |
| **Sliding Window Aggregation** | ThreatAggregator with 30-minute TTL + memory cleanup | Prevents memory leaks in long-running analysis |
| **Multi-Layer Publishing** | Kafka (primary) + direct ES (fallback) | Data reaches ES even if Kafka is down |

---

## 12. Performance Metrics & Claims

| Metric | Value | Source |
|---|---|---|
| Event Throughput | 200,000+ events/second | Kafka pipeline capacity |
| Anomaly Detection Accuracy | 91% | Isolation Forest on test data |
| Threat Response Time | < 3 seconds | Detection → Rule generation → SSH application |
| LLM Latency (Groq) | ~500ms | Cloud API response time |
| LLM Latency (Ollama) | ~3–5s | Local inference on consumer hardware |
| Kafka Topics | 7 | Event type segregation |
| Elasticsearch Indices | 4 | Structured data storage |
| React Dashboard Pages | 12 | Comprehensive SOC UI |
| Grafana Dashboards | 5 | Deep metric visualization |
| UI Components | 33 | Radix UI primitives |

---

## 13. Security Architecture & Considerations

### 13.1 Implemented Security

- Input sanitization on `rule.target` (shell metacharacter stripping, IP/domain regex validation)
- CORS restriction to whitelisted origins (localhost, 192.168.1.100, 192.168.1.101)
- Audit logging of all rule changes with approval status tracking
- Environment variable-based secret management (`.env` files, `.gitignore`d)
- Confidence-based human-in-the-loop approval gate

### 13.2 Known Limitations (Academic Scope)

- No JWT/API authentication on backend endpoints (demo mode)
- Hardcoded demo credentials in frontend (admin/firewall123)
- SSH to pfSense uses password authentication (should use key-based)
- Audit log uses synchronous JSON file I/O (race-condition prone at scale)
- No rate limiting on API endpoints
- WebSocket terminal sessions have no access control

### 13.3 Production Recommendations

- Add JWT-based API authentication middleware
- Use SSH keys instead of passwords for pfSense access
- Replace JSON file audit log with Kafka `automation-audit` topic
- Implement `express-rate-limit` on all endpoints
- Add TLS/HTTPS via Nginx reverse proxy
- Network segmentation (management interfaces on separate VLAN)

---

## 14. Benefits & Value Proposition

### For Security Operators:
- **Reduced MTTR (Mean Time To Respond):** Sub-3-second automated threat response vs. minutes/hours for manual analysis
- **Natural Language Interface:** No need to learn firewall syntax — type "Block that attacking IP" and the AI handles the rest
- **Rich Context:** Every detected threat comes with MITRE ATT&CK mapping, GeoIP location, OTX reputation, and LLM-generated explanation
- **Always-On Monitoring:** Dashboard continuously visualizes traffic patterns, anomalies, and threat trends

### For Organizations:
- **Cost-Effective:** Runs on consumer-grade hardware (4+ cores, 8GB+ RAM) using free/open-source software
- **Privacy Options:** Dual AI provider (cloud vs. local LLM) allows fully air-gapped operation
- **Compliance:** Complete audit trail of every automated and manual rule change
- **Scalability:** Kafka + Spark pipeline designed for horizontal scaling

### For Research:
- **Reproducibility:** Fully automated deployment scripts (one-click Ubuntu setup, Windows launcher)
- **Validation Framework:** Kali attack scripts provide repeatable adversary simulation
- **Metrics Dashboard:** AI Metrics page provides real-time model performance visualization (anomaly score distribution, MTTR trends, classification confidence, EPS)
- **Multi-Disciplinary:** Bridges Big Data (Kafka, Spark, ES), Machine Learning (Isolation Forest, Random Forest), NLP (LLM), and Network Security (pfSense, Suricata)

---

## 15. Summary — What Makes This Project Significant

FirewallAI demonstrates a **complete, working implementation** of an autonomous network defense system that:

1. **Ingests** real-time syslog data from a production firewall (pfSense) and IDS (Suricata) via a high-throughput Kafka streaming pipeline
2. **Analyzes** aggregated traffic patterns using dual ML models (unsupervised anomaly detection + supervised threat classification)
3. **Enriches** detected threats with external intelligence (GeoIP, AlienVault OTX, MITRE ATT&CK)
4. **Explains** threats in natural language using a Large Language Model (Gemma/LLaMA)
5. **Generates** structured firewall rules from both AI analysis and operator natural language prompts
6. **Applies** rules to a live firewall via SSH with confidence-based human-in-the-loop gating
7. **Visualizes** the entire pipeline through a premium React dashboard with 12 interactive pages
8. **Validates** its claims through repeatable Kali Linux adversary simulation with quantified detection metrics
9. **Deploys** via one-click automation scripts across a multi-VM topology mirroring real SOC environments

This is not a theoretical framework — it is a **functional proof-of-concept** with every layer implemented, connected, and demonstrable from end to end.

---

*Document generated from deep architecture audit on 2026-02-24. Based on commit analysis of the complete FirewallAI codebase.*
