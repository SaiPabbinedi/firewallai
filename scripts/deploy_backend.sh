#!/bin/bash
# =========================================
# Deploy Updated Backend to Ubuntu Server
# =========================================

# Configuration
UBUNTU_HOST="${UBUNTU_HOST:-192.168.1.101}"
UBUNTU_USER="${UBUNTU_USER:-ubuntu}"
LOCAL_SERVER="scripts/ubuntu/server_v2.js"
REMOTE_DIR="/home/${UBUNTU_USER}/firewall-backend"

echo "========================================="
echo " Deploying FirewallAI Backend"
echo "========================================="
echo "Target: ${UBUNTU_USER}@${UBUNTU_HOST}"
echo ""

# Check if server file exists
if [ ! -f "$LOCAL_SERVER" ]; then
    echo "ERROR: Server file not found: $LOCAL_SERVER"
    exit 1
fi

# Create remote directory and copy files
echo "[1/4] Creating remote directory..."
ssh ${UBUNTU_USER}@${UBUNTU_HOST} "mkdir -p ${REMOTE_DIR}"

echo "[2/4] Copying server file..."
scp "$LOCAL_SERVER" ${UBUNTU_USER}@${UBUNTU_HOST}:${REMOTE_DIR}/server.js

# Create package.json
echo "[3/4] Creating package.json..."
ssh ${UBUNTU_USER}@${UBUNTU_HOST} "cat > ${REMOTE_DIR}/package.json << 'EOF'
{
  \"name\": \"firewallai-backend\",
  \"version\": \"2.1.0\",
  \"description\": \"FirewallAI Backend Server with Dual AI Support\",
  \"main\": \"server.js\",
  \"scripts\": {
    \"start\": \"node server.js\",
    \"dev\": \"node server.js\"
  },
  \"dependencies\": {
    \"axios\": \"^1.6.0\",
    \"cors\": \"^2.8.5\",
    \"dotenv\": \"^16.3.1\",
    \"express\": \"^4.18.2\",
    \"node-pty\": \"^1.0.0\",
    \"node-ssh\": \"^13.1.0\",
    \"socket.io\": \"^4.7.2\"
  }
}
EOF"

# Create .env file template
echo "[4/4] Creating .env template..."
ssh ${UBUNTU_USER}@${UBUNTU_HOST} "cat > ${REMOTE_DIR}/.env << 'EOF'
# =========================================
# FirewallAI Backend Configuration
# =========================================
PORT=3001
HOST=0.0.0.0
NODE_ENV=production

# pfSense Configuration
PFSENSE_HOST=192.168.1.1
PFSENSE_USER=admin
PFSENSE_PASSWORD=pfsense

# AI Configuration
AI_PROVIDER=ollama
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:3b

# Optional: Groq API (cloud AI)
# GROQ_API_KEY=your-groq-api-key
# GROQ_MODEL=llama-3.3-70b-versatile

# Optional: Kafka
KAFKA_ENABLED=false
# KAFKA_BROKERS=localhost:9092

# Optional: Elasticsearch
ELASTICSEARCH_ENABLED=false
# ELASTICSEARCH_URL=http://localhost:9200
EOF"

echo ""
echo "========================================="
echo " Deployment Complete!"
echo "========================================="
echo ""
echo "Next Steps:"
echo "1. SSH to Ubuntu: ssh ${UBUNTU_USER}@${UBUNTU_HOST}"
echo "2. cd ${REMOTE_DIR}"
echo "3. Edit .env with your pfSense credentials"
echo "4. npm install"
echo "5. npm start (or use pm2: pm2 start server.js --name firewallai)"
echo ""
