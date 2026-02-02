# File Structure Reference

This document maps where each file should be deployed.

## Windows Development Machine

```
C:\Users\Administrator\Desktop\firewalldesign\
│
├── .env                          # Environment config (create from .env.example)
├── .env.example                  # Template for environment variables
├── README.md                     # Project documentation
├── DEPLOY_INSTRUCTIONS.md        # Deployment guide
├── FILE_STRUCTURE.md             # This file
├── package.json                  # Node.js dependencies
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript configuration
│
├── src/                          # React Dashboard Source
│   ├── app/
│   │   ├── App.tsx              # Main application component
│   │   ├── main.tsx             # Entry point
│   │   └── components/
│   │       ├── Dashboard.tsx         # Home dashboard
│   │       ├── AnalyticsPage.tsx     # Traffic analytics ⭐ ENHANCED
│   │       ├── LogsPage.tsx          # Log viewer ⭐ ENHANCED
│   │       ├── FirewallRulesPage.tsx # Rule management ⭐ ENHANCED
│   │       ├── AIInsightsPage.tsx    # AI threat intel ⭐ ENHANCED
│   │       ├── SettingsPage.tsx      # Settings
│   │       ├── GrafanaPage.tsx       # Embedded Grafana
│   │       ├── Terminal/             # Terminal components
│   │       │   ├── Terminal.tsx
│   │       │   ├── TerminalPage.tsx
│   │       │   └── TerminalWindow.tsx
│   │       └── ui/                   # UI components
│   │           └── AIRuleGenerator.tsx
│   ├── lib/
│   │   ├── env.ts               # Environment helpers
│   │   └── utils.ts             # Utility functions
│   └── types/
│       └── index.ts             # TypeScript types
│
├── backend/                      # Backend (for local dev only)
│   ├── server.js                # Original Groq-based server
│   ├── server_remote.js         # Remote Ubuntu version
│   └── package.json
│
├── scripts/                      # Deployment Scripts
│   ├── ubuntu/                   # → Copy to Ubuntu server
│   │   ├── deploy_ubuntu.sh          ⭐ NEW - Full deployment
│   │   ├── kafka_config.sh           ⭐ NEW - Create Kafka topics
│   │   ├── udp_to_kafka_v2.py        ⭐ NEW - Log bridge
│   │   ├── defense_engine_v2.py      ⭐ NEW - ML analytics (optional)
│   │   ├── server_v2.js              ⭐ NEW - Dual AI backend
│   │   ├── elasticsearch_setup.sh    ⭐ NEW - ES installation
│   │   ├── grafana_setup.sh          ⭐ NEW - Grafana installation
│   │   └── kafka_to_elasticsearch.py ⭐ NEW - ES connector
│   │
│   └── kali_attacks/             # → Copy to Kali Linux
│       ├── README.md                 ⭐ NEW - Attack documentation
│       ├── run_full_test.sh          ⭐ NEW - Test orchestrator
│       └── attacks/
│           ├── brute_force_ssh.sh    ⭐ NEW
│           ├── port_scan.sh          ⭐ NEW
│           ├── ddos_simulation.sh    ⭐ NEW
│           └── web_attacks.sh        ⭐ NEW
│
├── grafana/                      # → Copy to Ubuntu /var/lib/grafana/dashboards/
│   └── dashboards/
│       ├── traffic-overview.json    ⭐ NEW - Traffic dashboard
│       └── threat-detection.json    ⭐ NEW - Threat dashboard
│
├── FirewallAI-Launcher.ps1       # Windows launcher script
├── FirewallAI-Menu.bat           # Menu launcher
└── docker-compose.yml            # Docker deployment (optional)
```

## Ubuntu Server (192.168.1.101)

```
/home/ubuntu/
│
├── cyber-defense/                # Main project directory
│   ├── scripts/
│   │   ├── deploy_ubuntu.sh
│   │   ├── kafka_config.sh
│   │   ├── udp_to_kafka_v2.py
│   │   ├── defense_engine_v2.py
│   │   ├── elasticsearch_setup.sh
│   │   ├── grafana_setup.sh
│   │   └── kafka_to_elasticsearch.py
│   │
│   ├── elasticsearch/
│   │   └── templates/           # ES index templates (auto-created)
│   │
│   └── grafana/
│       └── dashboards/          # For reference only
│
├── firewall-backend/             # Node.js Backend
│   ├── server.js                # Active server (copy server_v2.js here)
│   ├── server_v2.js             # New version with dual AI
│   ├── package.json
│   ├── .env                     # MUST CREATE - credentials
│   ├── ai_blocklist.txt         # AI-generated blocklist
│   └── audit_log.json           # Rule audit trail
│
├── downloads/                    # Downloaded packages
│   └── kafka_2.13-3.9.0/        # Kafka installation
│
├── spark_env/                    # Python virtual environment
│
├── logs/                         # Log files
│   ├── backend.log
│   ├── kafka.log
│   ├── zookeeper.log
│   └── bridge.log
│
├── start_defense_system.sh       # Start all services
├── stop_defense_system.sh        # Stop all services
└── status_defense_system.sh      # Check status
```

## Grafana Dashboard Files

```
/var/lib/grafana/dashboards/      # Grafana auto-loads from here
├── traffic-overview.json         # Copy from Windows grafana/dashboards/
└── threat-detection.json         # Copy from Windows grafana/dashboards/
```

## Elasticsearch Indices

```
Indices (auto-created):
├── firewall-events-*             # pfSense firewall logs
├── suricata-alerts-*             # IDS/IPS alerts
└── threat-sessions-*             # ML analysis results
```

## Kafka Topics

```
Topics (created by kafka_config.sh):
├── firewall-logs                 # Raw firewall events
├── suricata-alerts               # IDS alerts
├── dns-queries                   # DNS queries
├── threat-intel                  # Threat intelligence
├── ai-analysis                   # LLM analysis results
├── automation-audit              # Rule changes
└── realtime-metrics              # Dashboard metrics
```

## Kali Linux

```
/home/kali/attack_tests/
├── README.md
├── run_full_test.sh
├── results/                      # Test results (auto-created)
└── attacks/
    ├── brute_force_ssh.sh
    ├── port_scan.sh
    ├── ddos_simulation.sh
    └── web_attacks.sh
```

---

## Deployment Checklist

### Ubuntu Server
- [ ] Run `deploy_ubuntu.sh`
- [ ] Run `elasticsearch_setup.sh`
- [ ] Run `grafana_setup.sh`
- [ ] Configure `firewall-backend/.env`
- [ ] Start services with `start_defense_system.sh`
- [ ] Verify with `status_defense_system.sh`

### Windows Machine
- [ ] Run `npm install`
- [ ] Create `.env` from `.env.example`
- [ ] Configure backend URL
- [ ] Run `npm run dev` or use launcher

### pfSense
- [ ] Enable remote syslog to Ubuntu:514
- [ ] Configure Suricata EVE JSON logging
- [ ] Install pfBlockerNG

### Grafana Dashboards
- [ ] Copy JSON files to `/var/lib/grafana/dashboards/`
- [ ] Restart grafana-server
- [ ] Configure data sources

### Kali Testing
- [ ] Copy attack scripts
- [ ] Install dependencies (nmap, hydra, hping3)
- [ ] Make scripts executable
