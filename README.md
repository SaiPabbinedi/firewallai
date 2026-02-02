# Adaptive Network Defense System
## Complete Implementation Guide

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.0-green.svg)]()

> A hybrid framework integrating Big Data Streams and Generative AI for autonomous firewall management.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Usage](#usage)
7. [API Reference](#api-reference)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)
10. [Security Considerations](#security-considerations)

---

## Overview

The Adaptive Network Defense System is a comprehensive cybersecurity solution that combines:

- **Big Data Streaming** - Apache Kafka for real-time log ingestion
- **Machine Learning** - Isolation Forest and Random Forest for threat detection
- **Generative AI** - Gemma/LLaMA for natural language threat analysis
- **Automated Response** - pfSense integration for immediate threat mitigation

### Key Features

| Feature | Description |
|---------|-------------|
| 🔄 Real-time Streaming | Process 200k+ events/second via Kafka |
| 🤖 AI Rule Generation | Natural language to firewall rule conversion |
| 🧠 Anomaly Detection | ML-based detection with 91% accuracy |
| 📊 Visual Dashboard | React-based real-time monitoring |
| 🔒 Automated Blocking | Sub-3-second threat response time |
| 📝 Audit Logging | Complete trail of all automated actions |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COLLECTION LAYER                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   pfSense    │    │   Suricata   │    │   DNS Logs   │              │
│  │   Firewall   │    │     IDS      │    │   (Unbound)  │              │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘              │
│         │                   │                   │                       │
│         └─────────────┬─────┴───────────────────┘                       │
│                       ▼                                                 │
│              ┌────────────────┐                                         │
│              │  UDP Bridge    │  (udp_to_kafka_v2.py)                   │
│              │  Port 514      │                                         │
│              └───────┬────────┘                                         │
└──────────────────────┼──────────────────────────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────────────────────────┐
│                      ▼        STREAMING LAYER                           │
│              ┌────────────────┐                                         │
│              │  Apache Kafka  │                                         │
│              │   (7 Topics)   │                                         │
│              └───────┬────────┘                                         │
│                      │                                                  │
│    ┌─────────────────┼─────────────────┐                               │
│    ▼                 ▼                 ▼                               │
│ ┌──────────┐   ┌──────────┐   ┌──────────────┐                         │
│ │firewall- │   │suricata- │   │realtime-     │                         │
│ │logs      │   │alerts    │   │metrics       │                         │
│ └────┬─────┘   └────┬─────┘   └──────┬───────┘                         │
└──────┼──────────────┼────────────────┼──────────────────────────────────┘
       │              │                │
┌──────┼──────────────┼────────────────┼──────────────────────────────────┐
│      ▼              ▼                ▼      ANALYTICS LAYER             │
│  ┌─────────────────────────────────────────┐                           │
│  │      Defense Engine (Spark + ML)        │                           │
│  │  ┌─────────────┐  ┌──────────────────┐  │                           │
│  │  │ Isolation   │  │  Random Forest   │  │                           │
│  │  │ Forest      │  │  Classifier      │  │                           │
│  │  └─────────────┘  └──────────────────┘  │                           │
│  │  ┌─────────────────────────────────┐    │                           │
│  │  │  Gemma LLM (via Ollama/Groq)    │    │                           │
│  │  └─────────────────────────────────┘    │                           │
│  └─────────────────────────────────────────┘                           │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────────────┐
│                             ▼    STORAGE & VISUALIZATION                │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐             │
│  │ Elasticsearch │   │    Grafana    │   │ React Dashboard│            │
│  │   (Indices)   │   │  (Dashboards) │   │    (UI)       │             │
│  └───────────────┘   └───────────────┘   └───────────────┘             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16+ GB |
| Storage | 50 GB SSD | 200+ GB SSD |
| Network | 1 Gbps | 10 Gbps |

### Software Requirements

#### Ubuntu Server (Backend)
- Ubuntu 22.04 LTS
- Java 11+
- Python 3.10+
- Node.js 18+
- Apache Kafka 3.x
- Elasticsearch 8.x
- Grafana 10.x

#### Windows Machine (Frontend)
- Windows 10/11
- Node.js 18+
- Git

#### pfSense Firewall
- pfSense 2.7+
- Suricata IDS/IPS
- pfBlockerNG

#### Kali Linux (Testing)
- Kali 2024.x
- nmap, hydra, hping3

---

## Installation

### Quick Start

```bash
# Clone repository
git clone https://github.com/Katarisai/Cybersecuritydashboarduidesign.git
cd Cybersecuritydashboarduidesign

# Install frontend dependencies
npm install

# Copy scripts to Ubuntu
scp -r scripts/ubuntu/* ubuntu@192.168.1.101:~/cyber-defense/scripts/
```

### Ubuntu Server Setup

```bash
# SSH into Ubuntu
ssh ubuntu@192.168.1.101

# Run deployment script
cd ~/cyber-defense/scripts
chmod +x deploy_ubuntu.sh
./deploy_ubuntu.sh

# Setup Elasticsearch
chmod +x elasticsearch_setup.sh
./elasticsearch_setup.sh

# Setup Grafana
chmod +x grafana_setup.sh
./grafana_setup.sh

# Start all services
~/start_defense_system.sh
```

### Windows Frontend Setup

```powershell
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your settings
notepad .env

# Start development server
npm run dev
```

---

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Backend Connection
VITE_BACKEND_URL=http://192.168.1.101:3001

# pfSense
PFSENSE_HOST=192.168.1.1
PFSENSE_USER=admin
PFSENSE_PASSWORD=your-password

# AI Provider (groq or ollama)
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile

# Ollama (alternative)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# Kafka
KAFKA_ENABLED=true
KAFKA_BROKERS=localhost:9092

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_ENABLED=true
```

### Kafka Topics

Configure topics in `kafka_config.sh`:

| Topic | Partitions | Retention | Purpose |
|-------|------------|-----------|---------|
| firewall-logs | 12 | 7 days | pfSense filterlog |
| suricata-alerts | 6 | 14 days | IDS/IPS alerts |
| dns-queries | 6 | 3 days | DNS resolution logs |
| threat-intel | 3 | 30 days | Threat intelligence feeds |
| ai-analysis | 3 | 14 days | LLM analysis results |
| automation-audit | 3 | 90 days | Rule change audit trail |
| realtime-metrics | 3 | 1 day | Dashboard metrics |

---

## Usage

### Starting the System

#### Ubuntu Server

```bash
# Start all components
~/start_defense_system.sh

# Check status
~/status_defense_system.sh

# View logs
tail -f ~/logs/backend.log
tail -f ~/logs/kafka.log
```

#### Windows Dashboard

```powershell
# Option 1: Use launcher
.\FirewallAI-Launcher.ps1

# Option 2: Manual start
npm run dev
```

### Dashboard Features

1. **Dashboard** - System overview and quick stats
2. **Terminal** - SSH terminal to Ubuntu server
3. **Logs** - Real-time log viewer with search
4. **Firewall Rules** - Manage block/allow rules
5. **Analytics** - Traffic analysis charts
6. **AI Insights** - ML-based threat intelligence
7. **Grafana** - Embedded Grafana dashboards

### AI Rule Generation

```bash
# Via API
curl -X POST http://192.168.1.101:3001/api/generate-rule \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Block IP 192.168.1.100 for brute force"}'

# Response
{
  "success": true,
  "rule": {
    "type": "ip",
    "target": "192.168.1.100",
    "action": "block",
    "interface": "both",
    "reason": "Brute force attack detected"
  }
}
```

---

## API Reference

### Health Check

```
GET /health
```

Returns system status and component health.

### AI Endpoints

```
GET  /api/ai/providers     - List available AI providers
POST /api/ai/switch        - Switch AI provider
POST /api/generate-rule    - Generate firewall rule from prompt
```

### Rule Management

```
POST /api/apply-rule       - Apply rule to pfSense
GET  /api/audit-log        - Get rule change history
GET  /api/approvals/pending - Get pending approvals
POST /api/approvals/:id/approve - Approve pending rule
```

### Analytics

```
GET  /api/stats/realtime   - Real-time statistics
GET  /api/logs/search      - Search logs (Elasticsearch)
GET  /api/logs/aggregations - Traffic aggregations
GET  /api/threats/summary  - Threat intelligence summary
```

---

## Testing

### Kali Linux Attack Simulation

```bash
# Copy attack scripts
scp -r scripts/kali_attacks/* kali@KALI_IP:~/attack_tests/

# SSH into Kali
ssh kali@KALI_IP

# Run full test suite
cd ~/attack_tests
chmod +x *.sh attacks/*.sh
./run_full_test.sh 192.168.1.1 5

# Individual attacks
./attacks/port_scan.sh 192.168.1.1
./attacks/brute_force_ssh.sh 192.168.1.1
./attacks/ddos_simulation.sh 192.168.1.1 80 30
./attacks/web_attacks.sh http://192.168.1.1
```

### Expected Detection Results

| Attack | Detection Time | Dashboard Indicator |
|--------|---------------|---------------------|
| Port Scan | <30s | Suricata alert |
| Brute Force | <60s | Anomaly + Alert |
| DDoS | <10s | Traffic spike |
| SQLi/XSS | <5s | IDS signature |

---

## Troubleshooting

### Common Issues

#### Backend won't start
```bash
# Check if port is in use
sudo netstat -tlnp | grep 3001

# Kill existing process
sudo kill $(lsof -t -i:3001)

# Check logs
cat ~/logs/backend.log
```

#### Kafka connection failed
```bash
# Check Kafka is running
~/status_defense_system.sh

# Restart Kafka
~/start_defense_system.sh
```

#### AI not responding
```bash
# Check Ollama
curl http://localhost:11434/api/tags

# Check Groq API key
echo $GROQ_API_KEY
```

#### Dashboard won't load
```powershell
# Check backend connection
curl http://192.168.1.101:3001/health

# Verify .env settings
cat .env
```

---

## Security Considerations

### Production Deployment

1. **Change default passwords**
   - pfSense admin password
   - Grafana admin password
   - SSH keys instead of passwords

2. **Enable HTTPS**
   - Use SSL/TLS for all connections
   - Configure Nginx reverse proxy

3. **Network segmentation**
   - Place management interfaces on separate VLAN
   - Restrict Kafka/Elasticsearch access

4. **API security**
   - Implement API key authentication
   - Rate limiting on all endpoints

5. **Audit logging**
   - All rule changes are logged
   - Regular backup of audit logs

### Environment Variables

**Never commit these to version control:**
- `PFSENSE_PASSWORD`
- `GROQ_API_KEY`
- `ELASTICSEARCH_PASSWORD`

---

## License

MIT License - See [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## Support

- 📧 Email: support@example.com
- 🐛 Issues: GitHub Issues
- 📖 Docs: This README

---

*Built with ❤️ for network defenders everywhere*