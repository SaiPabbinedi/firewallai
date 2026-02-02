#!/bin/bash

# ============================================
# FirewallAI - Ubuntu Server Startup Script
# ============================================
# This script starts all required services:
# - InfluxDB (metrics database)
# - Grafana (monitoring dashboards)  
# - Node.js Backend Server (Full Featured)
# ============================================

echo "=========================================="
echo "  FirewallAI Server Startup Script v2.1"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="$HOME/firewall-backend"
BACKEND_PID_FILE="$HOME/.firewall-backend.pid"
LOG_DIR="$HOME/logs"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to check if service is running
check_service() {
    if systemctl is-active --quiet $1 2>/dev/null; then
        echo -e "${GREEN}✓ $1 is running${NC}"
        return 0
    else
        echo -e "${RED}✗ $1 is not running${NC}"
        return 1
    fi
}

# Function to start service
start_service() {
    echo -e "${YELLOW}Starting $1...${NC}"
    sudo systemctl start $1
    sleep 2
    check_service $1
}

# Function to check if port is in use
check_port() {
    if netstat -tlnp 2>/dev/null | grep -q ":$1 "; then
        return 0
    else
        return 1
    fi
}

echo ""
echo -e "${CYAN}Step 1: Starting InfluxDB...${NC}"
echo "-------------------------------------------"
if ! check_service influxdb; then
    start_service influxdb
fi

echo ""
echo -e "${CYAN}Step 2: Starting Grafana...${NC}"
echo "-------------------------------------------"
if ! check_service grafana-server; then
    start_service grafana-server
fi

echo ""
echo -e "${CYAN}Step 3: Starting Node.js Backend...${NC}"
echo "-------------------------------------------"

# Check if backend is already running
if [ -f "$BACKEND_PID_FILE" ]; then
    PID=$(cat "$BACKEND_PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is already running (PID: $PID)${NC}"
        BACKEND_RUNNING=true
    else
        echo -e "${YELLOW}Stale PID file found, cleaning up...${NC}"
        rm -f "$BACKEND_PID_FILE"
        BACKEND_RUNNING=false
    fi
else
    BACKEND_RUNNING=false
fi

# Also check if port 3001 is in use (maybe started differently)
if [ "$BACKEND_RUNNING" = false ] && check_port 3001; then
    echo -e "${YELLOW}Port 3001 is in use. Killing existing process...${NC}"
    fuser -k 3001/tcp 2>/dev/null
    sleep 1
fi

if [ "$BACKEND_RUNNING" = false ]; then
    if [ -d "$BACKEND_DIR" ]; then
        cd "$BACKEND_DIR"
        
        # Check if node_modules exists
        if [ ! -d "node_modules" ]; then
            echo -e "${YELLOW}Installing dependencies...${NC}"
            npm install
        fi
        
        # Check if .env exists
        if [ ! -f ".env" ]; then
            echo -e "${YELLOW}Creating .env from template...${NC}"
            if [ -f ".env.example" ]; then
                cp .env.example .env
                echo -e "${YELLOW}⚠ Please edit .env with your settings!${NC}"
            fi
        fi
        
        echo "Starting server.js..."
        nohup node server.js > "$LOG_DIR/backend.log" 2>&1 &
        echo $! > "$BACKEND_PID_FILE"
        sleep 3

        if ps -p $(cat "$BACKEND_PID_FILE") > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend started (PID: $(cat $BACKEND_PID_FILE))${NC}"
        else
            echo -e "${RED}✗ Failed to start backend${NC}"
            echo -e "${YELLOW}Check logs: tail -f $LOG_DIR/backend.log${NC}"
        fi
    else
        echo -e "${RED}✗ Backend directory not found: $BACKEND_DIR${NC}"
        echo -e "${YELLOW}Please deploy the backend first.${NC}"
    fi
fi

echo ""
echo "=========================================="
echo "  Service Status Summary"
echo "=========================================="
echo ""

# Get local IP
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo -e "InfluxDB:  http://${LOCAL_IP}:8086"
check_service influxdb
echo ""

echo -e "Grafana:   http://${LOCAL_IP}:3000"
check_service grafana-server
echo ""

echo -e "Backend:   http://${LOCAL_IP}:3001"
if [ -f "$BACKEND_PID_FILE" ] && ps -p $(cat "$BACKEND_PID_FILE") > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running (PID: $(cat $BACKEND_PID_FILE))${NC}"
    
    # Test health endpoint
    sleep 1
    HEALTH=$(curl -s http://localhost:3001/health 2>/dev/null)
    if [ ! -z "$HEALTH" ]; then
        echo -e "${GREEN}✓ Health check passed${NC}"
        echo -e "  Response: $HEALTH"
    fi
else
    echo -e "${RED}✗ Backend is not running${NC}"
fi

echo ""
echo "=========================================="
echo -e "  ${GREEN}All services started!${NC}"
echo "=========================================="
echo ""
echo "Available Endpoints:"
echo "  - Health:       GET  http://${LOCAL_IP}:3001/health"
echo "  - AI Generate:  POST http://${LOCAL_IP}:3001/api/generate-rule"
echo "  - Apply Rule:   POST http://${LOCAL_IP}:3001/api/apply-rule"
echo "  - Realtime:     GET  http://${LOCAL_IP}:3001/api/stats/realtime"
echo "  - Audit Log:    GET  http://${LOCAL_IP}:3001/api/audit-log"
echo ""
echo "View logs: tail -f $LOG_DIR/backend.log"
echo ""
