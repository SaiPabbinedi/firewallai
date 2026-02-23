#!/bin/bash
# =============================================================================
# FirewallAI — Full Stack Stop Script
# =============================================================================
# Stops all services in reverse dependency order
# =============================================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_DIR="$HOME/cyber-defense"
PID_DIR="$BASE_DIR/.pids"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   FirewallAI — Stopping All Services                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

ok()   { echo -e "  ${GREEN}✓ $1${NC}"; }
info() { echo -e "  ${YELLOW}→ $1${NC}"; }

stop_process() {
    local name=$1
    local pidfile="$PID_DIR/${name}.pid"

    if [ -f "$pidfile" ]; then
        local pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            sleep 1
            # Force kill if still running
            kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
            ok "Stopped $name (PID: $pid)"
        else
            info "$name was not running"
        fi
        rm -f "$pidfile"
    else
        info "$name has no PID file"
    fi
}

# Stop in reverse order
echo "Stopping application services..."
stop_process "defense-engine"
stop_process "backend"
stop_process "udp-to-kafka"
stop_process "kafka-to-es"

echo ""
echo "Stopping infrastructure services..."

# Stop Grafana
sudo systemctl stop grafana-server 2>/dev/null && ok "Grafana stopped" || info "Grafana was not running"

# Stop Kafka
sudo systemctl stop kafka 2>/dev/null && ok "Kafka stopped" || info "Kafka was not running"
sudo systemctl stop zookeeper 2>/dev/null && ok "Zookeeper stopped" || info "Zookeeper was not running"

# Stop Elasticsearch
sudo systemctl stop elasticsearch 2>/dev/null && ok "Elasticsearch stopped" || info "Elasticsearch was not running"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   ALL SERVICES STOPPED                                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Also kill any stray Node.js processes on port 3001
fuser -k 3001/tcp 2>/dev/null && info "Cleared port 3001" || true
