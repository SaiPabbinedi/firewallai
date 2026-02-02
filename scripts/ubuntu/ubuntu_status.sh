#!/bin/bash

# ============================================
# FirewallAI - Ubuntu Server Status Script
# ============================================

echo "=========================================="
echo "  FirewallAI Server Status"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

BACKEND_PID_FILE="$HOME/.firewall-backend.pid"
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""

# Check InfluxDB
echo -e "${CYAN}InfluxDB (Port 8086):${NC}"
if systemctl is-active --quiet influxdb 2>/dev/null; then
    echo -e "  ${GREEN}✓ Running${NC}"
else
    echo -e "  ${RED}✗ Not Running${NC}"
fi

echo ""

# Check Grafana
echo -e "${CYAN}Grafana (Port 3000):${NC}"
if systemctl is-active --quiet grafana-server 2>/dev/null; then
    echo -e "  ${GREEN}✓ Running${NC}"
else
    echo -e "  ${RED}✗ Not Running${NC}"
fi

echo ""

# Check Backend
echo -e "${CYAN}Backend Server (Port 3001):${NC}"
BACKEND_STATUS="not running"
if [ -f "$BACKEND_PID_FILE" ]; then
    PID=$(cat "$BACKEND_PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Running (PID: $PID)${NC}"
        BACKEND_STATUS="running"
    else
        echo -e "  ${RED}✗ Not Running (stale PID)${NC}"
    fi
else
    # Check if port is in use anyway
    if netstat -tlnp 2>/dev/null | grep -q ":3001 "; then
        echo -e "  ${YELLOW}⚠ Port 3001 in use (no PID file)${NC}"
        BACKEND_STATUS="running"
    else
        echo -e "  ${RED}✗ Not Running${NC}"
    fi
fi

# If backend is running, check health
if [ "$BACKEND_STATUS" = "running" ]; then
    echo ""
    echo -e "${CYAN}Health Check:${NC}"
    HEALTH=$(curl -s --max-time 5 http://localhost:3001/health 2>/dev/null)
    if [ ! -z "$HEALTH" ]; then
        echo -e "  ${GREEN}✓ Healthy${NC}"
        
        # Parse and display AI status
        AI_READY=$(echo "$HEALTH" | grep -o '"ai_ready":[^,}]*' | cut -d':' -f2)
        if [ "$AI_READY" = "true" ]; then
            echo -e "  ${GREEN}✓ AI Ready${NC}"
        else
            echo -e "  ${YELLOW}⚠ AI Not Ready${NC}"
        fi
        
        echo ""
        echo -e "${CYAN}Full Health Response:${NC}"
        echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
    else
        echo -e "  ${RED}✗ Health check failed${NC}"
    fi
fi

echo ""
echo "=========================================="
echo "  Endpoints"
echo "=========================================="
echo ""
echo "  Dashboard:    http://${LOCAL_IP}:5173"
echo "  Grafana:      http://${LOCAL_IP}:3000"
echo "  Backend API:  http://${LOCAL_IP}:3001"
echo "  InfluxDB:     http://${LOCAL_IP}:8086"
echo ""
echo "=========================================="
