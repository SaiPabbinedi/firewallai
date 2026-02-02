#!/bin/bash

# ============================================
# FirewallAI - Ubuntu Server Stop Script
# ============================================

echo "=========================================="
echo "  FirewallAI Server Stop Script"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKEND_PID_FILE="$HOME/.firewall-backend.pid"

echo ""
echo "Stopping Backend Server..."
if [ -f "$BACKEND_PID_FILE" ]; then
    PID=$(cat "$BACKEND_PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        sleep 2
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${YELLOW}Process still running, force killing...${NC}"
            kill -9 $PID
        fi
        echo -e "${GREEN}✓ Backend stopped${NC}"
    else
        echo -e "${YELLOW}Backend was not running${NC}"
    fi
    rm -f "$BACKEND_PID_FILE"
else
    echo -e "${YELLOW}No PID file found${NC}"
    # Try to kill by port
    if fuser 3001/tcp > /dev/null 2>&1; then
        echo -e "${YELLOW}Killing process on port 3001...${NC}"
        fuser -k 3001/tcp
        echo -e "${GREEN}✓ Process killed${NC}"
    fi
fi

echo ""
echo "Do you want to stop Grafana and InfluxDB as well? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo "Stopping Grafana..."
    sudo systemctl stop grafana-server
    echo -e "${GREEN}✓ Grafana stopped${NC}"
    
    echo ""
    echo "Stopping InfluxDB..."
    sudo systemctl stop influxdb
    echo -e "${GREEN}✓ InfluxDB stopped${NC}"
fi

echo ""
echo "=========================================="
echo -e "  ${GREEN}Services stopped${NC}"
echo "=========================================="
