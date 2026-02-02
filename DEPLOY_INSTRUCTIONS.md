# Deployment Guide - Adaptive Network Defense System

This guide provides step-by-step instructions for deploying the complete system.

---

## Quick Reference

| Component | Machine | Port | Status Check |
|-----------|---------|------|--------------|
| React Dashboard | Windows | 5173 | http://localhost:5173 |
| Backend Server | Ubuntu | 3001 | http://192.168.1.101:3001/health |
| Kafka | Ubuntu | 9092 | ~/status_defense_system.sh |
| Zookeeper | Ubuntu | 2181 | ~/status_defense_system.sh |
| Elasticsearch | Ubuntu | 9200 | curl http://localhost:9200 |
| Grafana | Ubuntu | 3000 | http://192.168.1.101:3000 |
| pfSense | VM | 443 | https://192.168.1.1 |
| Suricata | pfSense | - | Services → Suricata |

---

## Step 1: pfSense Configuration

### 1.1 Enable Syslog Forwarding

1. Go to **Status → System Logs → Settings**
2. Under **Remote Logging Options**:
   - ✅ Enable Remote Logging
   - **Remote Log Servers**: `192.168.1.101:514`
   - **Remote Syslog Contents**: ✅ Firewall Events

### 1.2 Configure Suricata

1. Go to **Services → Suricata → Interfaces → WAN**
2. Enable **EVE JSON Log**:
   - EVE Output: ✅ Enabled
   - EVE Log Format: JSON
3. Configure syslog output in `/usr/local/etc/suricata/suricata.yaml`:

```yaml
outputs:
  - eve-log:
      enabled: yes
      filetype: syslog
      identity: "suricata"
      facility: local7
      level: Info
```

### 1.3 Install pfBlockerNG

1. Go to **System → Package Manager → Available Packages**
2. Install **pfBlockerNG-devel**
3. Configure DNSBL for domain blocking

---

## Step 2: Ubuntu Server Deployment

### 2.1 Initial Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y openjdk-17-jdk python3-pip nodejs npm git curl

# Create project directory
mkdir -p ~/cyber-defense/{scripts,logs}
cd ~/cyber-defense
```

### 2.2 Copy Scripts from Windows

On your Windows machine:

```powershell
# Copy all Ubuntu scripts
scp scripts/ubuntu/*.sh ubuntu@192.168.1.101:~/cyber-defense/scripts/
scp scripts/ubuntu/*.py ubuntu@192.168.1.101:~/cyber-defense/scripts/
scp scripts/ubuntu/*.js ubuntu@192.168.1.101:~/cyber-defense/scripts/

# Copy Grafana dashboards
scp grafana/dashboards/*.json ubuntu@192.168.1.101:~/cyber-defense/grafana/
```

### 2.3 Run Deployment Script

```bash
# Make scripts executable
chmod +x ~/cyber-defense/scripts/*.sh

# Run main deployment
cd ~/cyber-defense/scripts
./deploy_ubuntu.sh
```

This will install:
- Apache Kafka 3.9.0
- Zookeeper
- Python dependencies
- Node.js backend
- Ollama (optional)

### 2.4 Setup Elasticsearch

```bash
./elasticsearch_setup.sh
```

This creates:
- Elasticsearch service
- Index templates for firewall-events, suricata-alerts, threat-sessions
- ILM policies for data retention

### 2.5 Setup Grafana

```bash
./grafana_setup.sh
```

Then import dashboards:

```bash
# Copy dashboard files
sudo cp ~/cyber-defense/grafana/*.json /var/lib/grafana/dashboards/
sudo chown grafana:grafana /var/lib/grafana/dashboards/*.json
sudo systemctl restart grafana-server
```

### 2.6 Configure Backend

```bash
cd ~/firewall-backend

# Create .env file
cat > .env << 'EOF'
PORT=3001
PFSENSE_HOST=192.168.1.1
PFSENSE_USER=admin
PFSENSE_PASSWORD=your-pfsense-password
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile
KAFKA_ENABLED=true
KAFKA_BROKERS=localhost:9092
ELASTICSEARCH_URL=http://localhost:9200
EOF

# Install dependencies
npm install

# If replacing server.js with new version
cp ~/cyber-defense/scripts/server_v2.js server.js
npm install kafkajs axios groq-sdk
```

### 2.7 Start All Services

```bash
# Start the complete system
~/start_defense_system.sh

# Verify all components
~/status_defense_system.sh
```

### 2.8 Start Kafka-to-Elasticsearch Connector (Optional)

```bash
# Install Python dependencies
pip3 install kafka-python elasticsearch

# Run connector
python3 ~/cyber-defense/scripts/kafka_to_elasticsearch.py &
```

---

## Step 3: Windows Dashboard Deployment

### 3.1 Install Dependencies

```powershell
cd C:\Users\Administrator\Desktop\firewalldesign

# Install npm packages
npm install
```

### 3.2 Configure Environment

```powershell
# Copy example config
cp .env.example .env

# Edit with your settings
notepad .env
```

Set these values:
```env
VITE_BACKEND_URL=http://192.168.1.101:3001
VITE_GRAFANA_URL=http://192.168.1.101:3000/d/cyber-traffic/
```

### 3.3 Start Dashboard

```powershell
# Development mode
npm run dev

# Or use the launcher
.\FirewallAI-Launcher.ps1
```

Access at: http://localhost:5173

---

## Step 4: Kali Linux Testing Setup

### 4.1 Copy Attack Scripts

```powershell
# From Windows
scp -r scripts/kali_attacks/* kali@KALI_IP:~/attack_tests/
```

### 4.2 Install Dependencies on Kali

```bash
# SSH into Kali
ssh kali@KALI_IP

# Install required tools
sudo apt update
sudo apt install -y nmap hydra hping3 curl nikto

# Make scripts executable
chmod +x ~/attack_tests/*.sh
chmod +x ~/attack_tests/attacks/*.sh
```

### 4.3 Run Test Suite

```bash
cd ~/attack_tests

# Edit target IP
export TARGET_IP=192.168.1.1

# Run full test suite
./run_full_test.sh $TARGET_IP 5
```

---

## Step 5: Verification

### 5.1 Check Backend Health

```bash
curl http://192.168.1.101:3001/health
```

Expected response:
```json
{
  "status": "running",
  "ai": {
    "provider": "groq",
    "groq_ready": true,
    "ollama_ready": false
  },
  "kafka": "connected"
}
```

### 5.2 Check Elasticsearch

```bash
curl http://192.168.1.101:9200/_cat/indices?v
```

Should show:
```
health status index                  pri rep docs.count
green  open   firewall-events-000001   2   0          0
green  open   suricata-alerts-000001   2   0          0
green  open   threat-sessions-000001   1   0          0
```

### 5.3 Check Grafana

1. Open http://192.168.1.101:3000
2. Login with admin/admin
3. Navigate to **Dashboards → Cyber Defense**

### 5.4 Generate Test Traffic

```bash
# From pfSense or any machine
ping 8.8.8.8
curl http://example.com
```

Check logs appear in:
- Dashboard → Logs page
- Grafana → Traffic Overview

---

## Maintenance

### Daily Tasks
- Check `/health` endpoint
- Review pending rule approvals
- Monitor disk space

### Weekly Tasks
- Review audit logs
- Update threat intelligence
- Backup Elasticsearch indices

### Monthly Tasks
- Update system packages
- Review and tune ML models
- Test disaster recovery

---

## Ports & Firewall Rules

Ensure these ports are open between components:

| From | To | Port | Protocol | Purpose |
|------|-----|-----|----------|---------|
| pfSense | Ubuntu | 514 | UDP | Syslog |
| Windows | Ubuntu | 3001 | TCP | Backend API |
| Windows | Ubuntu | 3000 | TCP | Grafana |
| Windows | Ubuntu | 9200 | TCP | Elasticsearch |
| Ubuntu | pfSense | 22 | TCP | SSH (rule apply) |
| Kali | pfSense | * | TCP/UDP | Attack testing |

---

## Troubleshooting

### Services Not Starting

```bash
# Check logs
cat ~/logs/kafka.log
cat ~/logs/backend.log
journalctl -u elasticsearch
journalctl -u grafana-server

# Restart services
~/stop_defense_system.sh
~/start_defense_system.sh
```

### No Logs Appearing

1. Check pfSense syslog is sending
2. Verify UDP bridge is running
3. Check Kafka topics have messages

```bash
# Check UDP bridge
netstat -ulnp | grep 514

# Check Kafka messages
~/downloads/kafka_2.13-3.9.0/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic firewall-logs \
  --from-beginning \
  --max-messages 5
```

### Dashboard Connection Failed

```powershell
# Test backend connection
curl http://192.168.1.101:3001/health

# Check firewall
Test-NetConnection -ComputerName 192.168.1.101 -Port 3001
```

---

## Support

For issues or questions:
1. Check this documentation
2. Review log files
3. Open GitHub Issue if needed
