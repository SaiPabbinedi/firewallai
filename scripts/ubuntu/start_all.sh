#!/bin/bash
# =============================================================================
# FirewallAI — Full Stack Startup Script (v2)
# =============================================================================
# Starts all services in correct dependency order:
#   1. Elasticsearch
#   2. Kafka (Zookeeper → Broker → Topic creation)
#   3. Grafana
#   4. Kafka-to-ES Connector (Python)
#   5. UDP-to-Kafka Bridge (Python)
#   6. Node.js Backend (server_v2.js)
#   7. Spark Defense Engine (Python)
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

BASE_DIR="$HOME/cyber-defense"
LOG_DIR="$BASE_DIR/logs"
PID_DIR="$BASE_DIR/.pids"
mkdir -p "$LOG_DIR" "$PID_DIR"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   FirewallAI — Full Stack Startup (v2)                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

ok()   { echo -e "  ${GREEN}✓ $1${NC}"; }
fail() { echo -e "  ${RED}✗ $1${NC}"; }
info() { echo -e "  ${YELLOW}→ $1${NC}"; }

check_service() {
    systemctl is-active --quiet "$1" 2>/dev/null
}

start_systemd() {
    local svc=$1
    if check_service "$svc"; then
        ok "$svc already running"
    else
        info "Starting $svc..."
        sudo systemctl start "$svc"
        sleep 2
        if check_service "$svc"; then
            ok "$svc started"
        else
            fail "$svc failed to start"
        fi
    fi
}

start_process() {
    local name=$1
    local cmd=$2
    local workdir=${3:-$BASE_DIR}
    local pidfile="$PID_DIR/${name}.pid"
    local logfile="$LOG_DIR/${name}.log"

    # Check if already running
    if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
        ok "$name already running (PID: $(cat "$pidfile"))"
        return
    fi

    info "Starting $name..."
    cd "$workdir"
    nohup $cmd > "$logfile" 2>&1 &
    echo $! > "$pidfile"
    sleep 2

    if kill -0 "$(cat "$pidfile")" 2>/dev/null; then
        ok "$name started (PID: $(cat "$pidfile"), log: $logfile)"
    else
        fail "$name failed to start — check $logfile"
    fi
}

# ─────────────────────────────────────────────
echo -e "${CYAN}[1/7] Elasticsearch${NC}"
# ─────────────────────────────────────────────
start_systemd elasticsearch

echo ""
echo -e "${CYAN}[2/7] Kafka${NC}"
# ─────────────────────────────────────────────
start_systemd zookeeper 2>/dev/null || info "Zookeeper may not be a systemd service"
sleep 2
start_systemd kafka 2>/dev/null || info "Kafka may not be a systemd service"
sleep 3

# Create topics if they don't exist
for topic in firewall-logs suricata-alerts ai-analysis ai-metrics realtime-metrics automation-audit; do
    kafka-topics.sh --create --if-not-exists --topic "$topic" \
        --bootstrap-server localhost:9092 \
        --partitions 3 --replication-factor 1 2>/dev/null && \
        ok "Topic: $topic" || info "Topic $topic may already exist"
done

echo ""
echo -e "${CYAN}[3/7] Grafana${NC}"
# ─────────────────────────────────────────────
start_systemd grafana-server

# Copy dashboards to provisioning directory
if [ -d "$BASE_DIR/grafana/dashboards" ]; then
    sudo cp "$BASE_DIR/grafana/dashboards/"*.json /var/lib/grafana/dashboards/ 2>/dev/null && \
        ok "Dashboards provisioned" || info "No dashboards to provision"
fi

echo ""
echo -e "${CYAN}[4/7] Kafka-to-ES Connector${NC}"
# ─────────────────────────────────────────────
start_process "kafka-to-es" \
    "python3 $BASE_DIR/connectors/kafka_to_elasticsearch.py" \
    "$BASE_DIR/connectors"

echo ""
echo -e "${CYAN}[5/7] UDP-to-Kafka Bridge${NC}"
# ─────────────────────────────────────────────
start_process "udp-to-kafka" \
    "python3 $BASE_DIR/connectors/udp_to_kafka_v2.py" \
    "$BASE_DIR/connectors"

echo ""
echo -e "${CYAN}[6/7] Node.js Backend (server_v2.js)${NC}"
# ─────────────────────────────────────────────
if [ ! -d "$BASE_DIR/backend/node_modules" ]; then
    info "Installing npm dependencies..."
    cd "$BASE_DIR/backend" && npm install --production 2>&1 | tail -1
fi
start_process "backend" \
    "node $BASE_DIR/backend/server_v2.js" \
    "$BASE_DIR/backend"

echo ""
echo -e "${CYAN}[7/7] Spark Defense Engine${NC}"
# ─────────────────────────────────────────────
start_process "defense-engine" \
    "python3 $BASE_DIR/spark/defense_engine_v2.py" \
    "$BASE_DIR/spark"

# ─────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   ALL SERVICES STARTED                                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

LOCAL_IP=$(hostname -I | awk '{print $1}')
echo "  Endpoints:"
echo "    Backend API:    http://${LOCAL_IP}:3001/health"
echo "    Grafana:        http://${LOCAL_IP}:3000"
echo "    Elasticsearch:  http://${LOCAL_IP}:9200"
echo ""
echo "  API Endpoints:"
echo "    GET  /api/stats/realtime"
echo "    GET  /api/threats/summary"
echo "    GET  /api/metrics/snapshot"
echo "    POST /api/generate-rule"
echo ""
echo "  Logs:  tail -f $LOG_DIR/*.log"
echo "  PIDs:  ls $PID_DIR/"
echo ""

# Health check
sleep 2
HEALTH=$(curl -s http://localhost:3001/health 2>/dev/null)
if [ ! -z "$HEALTH" ]; then
    ok "Backend health check passed"
else
    info "Backend may still be starting..."
fi
