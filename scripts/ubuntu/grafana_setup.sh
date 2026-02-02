#!/bin/bash
# ===========================================
# Grafana Setup Script
# ===========================================
# Installs and configures Grafana with
# pre-built dashboards for the Cyber Defense System
# ===========================================

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   GRAFANA SETUP - Cyber Defense System                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Configuration
GRAFANA_VERSION="10.2.3"
GRAFANA_PORT=3000
GRAFANA_ADMIN_USER="admin"
GRAFANA_ADMIN_PASS="cyberdefense123"

# ===========================================
# Step 1: Install Grafana
# ===========================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[1/5] Installing Grafana..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Add Grafana repository
sudo apt-get install -y apt-transport-https software-properties-common wget
sudo mkdir -p /etc/apt/keyrings/
wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/grafana.gpg > /dev/null
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | sudo tee -a /etc/apt/sources.list.d/grafana.list

sudo apt-get update
sudo apt-get install -y grafana

# ===========================================
# Step 2: Configure Grafana
# ===========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[2/5] Configuring Grafana..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backup and modify config
sudo cp /etc/grafana/grafana.ini /etc/grafana/grafana.ini.bak

# Enable anonymous access for easy integration
sudo sed -i 's/;enabled = false/enabled = true/' /etc/grafana/grafana.ini
sudo sed -i 's/;org_name = Main Org./org_name = CyberDefense/' /etc/grafana/grafana.ini
sudo sed -i 's/;org_role = Viewer/org_role = Viewer/' /etc/grafana/grafana.ini

# Allow embedding in iframes (for dashboard integration)
sudo tee -a /etc/grafana/grafana.ini > /dev/null << EOF

[security]
allow_embedding = true

[auth.anonymous]
enabled = true
org_name = CyberDefense
org_role = Viewer

[users]
default_theme = dark
EOF

# ===========================================
# Step 3: Start Grafana
# ===========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[3/5] Starting Grafana..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sudo systemctl daemon-reload
sudo systemctl enable grafana-server
sudo systemctl start grafana-server

# Wait for Grafana to start
echo "Waiting for Grafana to start..."
for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo "Grafana is running!"
        break
    fi
    sleep 2
    echo "  Waiting... ($i/30)"
done

# ===========================================
# Step 4: Configure Data Sources
# ===========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[4/5] Configuring data sources..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create data sources directory
mkdir -p ~/cyber-defense/grafana

# Add Elasticsearch data source
curl -s -X POST "http://admin:admin@localhost:3000/api/datasources" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Elasticsearch-Firewall",
        "type": "elasticsearch",
        "url": "http://localhost:9200",
        "access": "proxy",
        "database": "firewall-events",
        "jsonData": {
            "timeField": "@timestamp",
            "esVersion": "8.0.0",
            "maxConcurrentShardRequests": 5,
            "logMessageField": "raw_message",
            "logLevelField": "action"
        }
    }'

curl -s -X POST "http://admin:admin@localhost:3000/api/datasources" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Elasticsearch-Suricata",
        "type": "elasticsearch",
        "url": "http://localhost:9200",
        "access": "proxy",
        "database": "suricata-alerts",
        "jsonData": {
            "timeField": "@timestamp",
            "esVersion": "8.0.0",
            "maxConcurrentShardRequests": 5,
            "logMessageField": "alert.signature",
            "logLevelField": "alert.severity"
        }
    }'

echo ""
echo "Data sources configured"

# ===========================================
# Step 5: Import Dashboards
# ===========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[5/5] Creating dashboards..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Dashboard JSON files will be created separately and imported
echo "Dashboard provisioning configured"
echo "Dashboards will be available after JSON files are placed in /var/lib/grafana/dashboards/"

# Create provisioning directory
sudo mkdir -p /var/lib/grafana/dashboards
sudo mkdir -p /etc/grafana/provisioning/dashboards

# Create dashboard provisioning config
sudo tee /etc/grafana/provisioning/dashboards/cyber-defense.yaml > /dev/null << 'EOF'
apiVersion: 1

providers:
  - name: 'Cyber Defense Dashboards'
    orgId: 1
    folder: 'Cyber Defense'
    folderUid: 'cyber-defense'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
EOF

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   GRAFANA SETUP COMPLETE!                                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Grafana URL: http://localhost:3000"
echo "Username: admin"
echo "Password: admin (change on first login)"
echo ""
echo "Anonymous access enabled for dashboard embedding"
echo ""
echo "Next: Copy dashboard JSON files to /var/lib/grafana/dashboards/"
echo ""
