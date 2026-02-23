#!/bin/bash
# ===========================================
# Elasticsearch Setup Script
# ===========================================
# Installs and configures Elasticsearch for
# the Cyber Defense System log storage
# ===========================================

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   ELASTICSEARCH SETUP - Cyber Defense System               ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Configuration
ES_VERSION="8.12.0"
ES_HOME="/opt/elasticsearch"
ES_DATA="/var/lib/elasticsearch"
ES_LOGS="/var/log/elasticsearch"
ES_USER="elasticsearch"

# ===========================================
# Step 1: Install Java (required)
# ===========================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[1/6] Checking Java installation..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! command -v java &> /dev/null; then
    echo "Installing OpenJDK 17..."
    sudo apt update
    sudo apt install -y openjdk-17-jdk
fi

java -version

# ===========================================
# Step 2: Download and Install Elasticsearch
# ===========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[2/6] Installing Elasticsearch..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Add Elasticsearch GPG key and repository
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list

sudo apt update
sudo apt install -y elasticsearch

# ===========================================
# Step 3: Configure Elasticsearch
# ===========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[3/6] Configuring Elasticsearch..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backup original config
sudo cp /etc/elasticsearch/elasticsearch.yml /etc/elasticsearch/elasticsearch.yml.bak

# Create optimized configuration
sudo tee /etc/elasticsearch/elasticsearch.yml > /dev/null << 'EOF'
# ======================== Elasticsearch Configuration =========================
# Cyber Defense System - Optimized for Log Storage

# Cluster
cluster.name: cyber-defense
node.name: node-1

# Paths
path.data: /var/lib/elasticsearch
path.logs: /var/log/elasticsearch

# Network - Allow connections from dashboard
network.host: 0.0.0.0
http.port: 9200

# Discovery (single node for development)
discovery.type: single-node

# Security (disabled for local development - enable in production!)
xpack.security.enabled: false
xpack.security.enrollment.enabled: false
xpack.security.http.ssl.enabled: false
xpack.security.transport.ssl.enabled: false

# Memory settings
bootstrap.memory_lock: false

# Performance tuning for log ingestion
indices.memory.index_buffer_size: 20%
thread_pool.write.queue_size: 1000
EOF

# Set JVM heap size (use 50% of available RAM, max 4GB for dev)
TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
HEAP_SIZE=$((TOTAL_MEM / 2))
if [ $HEAP_SIZE -gt 4096 ]; then
    HEAP_SIZE=4096
fi
if [ $HEAP_SIZE -lt 512 ]; then
    HEAP_SIZE=512
fi

sudo tee /etc/elasticsearch/jvm.options.d/heap.options > /dev/null << EOF
-Xms${HEAP_SIZE}m
-Xmx${HEAP_SIZE}m
EOF

echo "Heap size set to ${HEAP_SIZE}MB"

# ===========================================
# Step 4: Create Index Templates
# ===========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[4/6] Creating index templates..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create template files directory
mkdir -p ~/cyber-defense/elasticsearch/templates

# Firewall Events Template
cat > ~/cyber-defense/elasticsearch/templates/firewall-events.json << 'EOF'
{
  "index_patterns": ["firewall-events-*"],
  "template": {
    "settings": {
      "number_of_shards": 2,
      "number_of_replicas": 0,
      "index.lifecycle.name": "firewall-policy",
      "index.lifecycle.rollover_alias": "firewall-events"
    },
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "src_ip": { "type": "ip" },
        "dst_ip": { "type": "ip" },
        "src_port": { "type": "integer" },
        "dst_port": { "type": "integer" },
        "protocol": { "type": "keyword" },
        "action": { "type": "keyword" },
        "interface": { "type": "keyword" },
        "direction": { "type": "keyword" },
        "reason": { "type": "keyword" },
        "bytes": { "type": "long" },
        "packets": { "type": "long" },
        "duration": { "type": "float" },
        "rule_id": { "type": "keyword" },
        "geo": {
          "properties": {
            "country": { "type": "keyword" },
            "city": { "type": "keyword" },
            "location": { "type": "geo_point" }
          }
        },
        "threat": {
          "properties": {
            "category": { "type": "keyword" },
            "severity": { "type": "integer" },
            "score": { "type": "float" }
          }
        }
      }
    }
  }
}
EOF

# Suricata Alerts Template
cat > ~/cyber-defense/elasticsearch/templates/suricata-alerts.json << 'EOF'
{
  "index_patterns": ["suricata-alerts-*"],
  "template": {
    "settings": {
      "number_of_shards": 2,
      "number_of_replicas": 0,
      "index.lifecycle.name": "suricata-policy",
      "index.lifecycle.rollover_alias": "suricata-alerts"
    },
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "event_type": { "type": "keyword" },
        "src_ip": { "type": "ip" },
        "dest_ip": { "type": "ip" },
        "src_port": { "type": "integer" },
        "dest_port": { "type": "integer" },
        "proto": { "type": "keyword" },
        "alert": {
          "properties": {
            "signature": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
            "signature_id": { "type": "integer" },
            "severity": { "type": "integer" },
            "category": { "type": "keyword" },
            "action": { "type": "keyword" }
          }
        },
        "flow_id": { "type": "long" },
        "in_iface": { "type": "keyword" }
      }
    }
  }
}
EOF

# Threat Sessions Template
cat > ~/cyber-defense/elasticsearch/templates/threat-sessions.json << 'EOF'
{
  "index_patterns": ["threat-sessions-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "index.lifecycle.name": "threat-policy",
      "index.lifecycle.rollover_alias": "threat-sessions"
    },
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "session_id": { "type": "keyword" },
        "src_ip": { "type": "ip" },
        "dst_ip": { "type": "ip" },
        "duration_seconds": { "type": "float" },
        "packet_count": { "type": "long" },
        "byte_count": { "type": "long" },
        "unique_ports": { "type": "integer" },
        "protocols": { "type": "keyword" },
        "anomaly_score": { "type": "float" },
        "is_anomaly": { "type": "boolean" },
        "threat_classification": { "type": "keyword" },
        "threat_confidence": { "type": "float" },
        "llm_analysis": {
          "properties": {
            "threat_level": { "type": "keyword" },
            "attack_type": { "type": "keyword" },
            "explanation": { "type": "text" },
            "recommendation": { "type": "text" }
          }
        },
        "automated_action": {
          "properties": {
            "type": { "type": "keyword" },
            "target": { "type": "keyword" },
            "status": { "type": "keyword" },
            "applied_at": { "type": "date" }
          }
        }
      }
    }
  }
}
EOF

# AI Metrics Template (for defense_engine_v2.py MetricsTracker output)
cat > ~/cyber-defense/elasticsearch/templates/ai-metrics.json << 'EOF'
{
  "index_patterns": ["ai-metrics-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "index.lifecycle.name": "ai-metrics-policy",
      "index.lifecycle.rollover_alias": "ai-metrics"
    },
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "metric_type": { "type": "keyword" },
        "source": { "type": "keyword" },

        "anomalies_detected_window": { "type": "integer" },
        "anomalies_detected_total": { "type": "long" },
        "avg_anomaly_score": { "type": "float" },
        "anomaly_score_min": { "type": "float" },
        "anomaly_score_max": { "type": "float" },
        "anomaly_score": { "type": "float" },
        "is_anomaly": { "type": "boolean" },

        "avg_classification_confidence": { "type": "float" },
        "threat_confidence": { "type": "float" },
        "classification": { "type": "keyword" },
        "threat_classification": { "type": "keyword" },

        "avg_llm_latency_ms": { "type": "float" },
        "max_llm_latency_ms": { "type": "float" },
        "min_llm_latency_ms": { "type": "float" },
        "llm_latency_ms": { "type": "float" },

        "avg_mttr_seconds": { "type": "float" },
        "min_mttr_seconds": { "type": "float" },
        "max_mttr_seconds": { "type": "float" },
        "mttr_seconds": { "type": "float" },
        "sub_3s_response_rate": { "type": "float" },

        "rules_generated_window": { "type": "integer" },
        "rules_generated_total": { "type": "long" },
        "auto_blocks": { "type": "integer" },
        "manual_blocks": { "type": "integer" },

        "events_processed_total": { "type": "long" },
        "events_per_second": { "type": "float" },
        "sessions_analyzed_total": { "type": "long" },

        "src_ip": { "type": "ip" },
        "session_id": { "type": "keyword" }
      }
    }
  }
}
EOF

echo "Templates created in ~/cyber-defense/elasticsearch/templates/"

# ===========================================
# Step 5: Start Elasticsearch
# ===========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[5/6] Starting Elasticsearch..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sudo systemctl daemon-reload
sudo systemctl enable elasticsearch
sudo systemctl start elasticsearch

# Wait for Elasticsearch to start
echo "Waiting for Elasticsearch to start..."
for i in {1..30}; do
    if curl -s http://localhost:9200 > /dev/null 2>&1; then
        echo "Elasticsearch is running!"
        break
    fi
    sleep 2
    echo "  Waiting... ($i/30)"
done

# ===========================================
# Step 6: Apply Index Templates
# ===========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[6/6] Applying index templates..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Apply templates
curl -s -X PUT "http://localhost:9200/_index_template/firewall-events" \
    -H "Content-Type: application/json" \
    -d @~/cyber-defense/elasticsearch/templates/firewall-events.json

curl -s -X PUT "http://localhost:9200/_index_template/suricata-alerts" \
    -H "Content-Type: application/json" \
    -d @~/cyber-defense/elasticsearch/templates/suricata-alerts.json

curl -s -X PUT "http://localhost:9200/_index_template/threat-sessions" \
    -H "Content-Type: application/json" \
    -d @~/cyber-defense/elasticsearch/templates/threat-sessions.json

# Create ILM policies for data retention
curl -s -X PUT "http://localhost:9200/_ilm/policy/firewall-policy" \
    -H "Content-Type: application/json" \
    -d '{
        "policy": {
            "phases": {
                "hot": { "actions": { "rollover": { "max_size": "10gb", "max_age": "7d" } } },
                "delete": { "min_age": "30d", "actions": { "delete": {} } }
            }
        }
    }'

curl -s -X PUT "http://localhost:9200/_ilm/policy/suricata-policy" \
    -H "Content-Type: application/json" \
    -d '{
        "policy": {
            "phases": {
                "hot": { "actions": { "rollover": { "max_size": "5gb", "max_age": "7d" } } },
                "delete": { "min_age": "90d", "actions": { "delete": {} } }
            }
        }
    }'

# Create initial indices
curl -s -X PUT "http://localhost:9200/firewall-events-000001" \
    -H "Content-Type: application/json" \
    -d '{ "aliases": { "firewall-events": { "is_write_index": true } } }'

curl -s -X PUT "http://localhost:9200/suricata-alerts-000001" \
    -H "Content-Type: application/json" \
    -d '{ "aliases": { "suricata-alerts": { "is_write_index": true } } }'

curl -s -X PUT "http://localhost:9200/threat-sessions-000001" \
    -H "Content-Type: application/json" \
    -d '{ "aliases": { "threat-sessions": { "is_write_index": true } } }'

curl -s -X PUT "http://localhost:9200/_index_template/ai-metrics" \
    -H "Content-Type: application/json" \
    -d @~/cyber-defense/elasticsearch/templates/ai-metrics.json

curl -s -X PUT "http://localhost:9200/_ilm/policy/ai-metrics-policy" \
    -H "Content-Type: application/json" \
    -d '{
        "policy": {
            "phases": {
                "hot": { "actions": { "rollover": { "max_size": "2gb", "max_age": "7d" } } },
                "delete": { "min_age": "30d", "actions": { "delete": {} } }
            }
        }
    }'

curl -s -X PUT "http://localhost:9200/ai-metrics-000001" \
    -H "Content-Type: application/json" \
    -d '{ "aliases": { "ai-metrics": { "is_write_index": true } } }'

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   ELASTICSEARCH SETUP COMPLETE!                            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Elasticsearch URL: http://localhost:9200"
echo ""
echo "Indices created:"
echo "  - firewall-events (alias for rolling indices)"
echo "  - suricata-alerts (alias for rolling indices)"
echo "  - threat-sessions (alias for rolling indices)"
echo "  - ai-metrics     (alias for rolling indices)"
echo ""
echo "Test with: curl http://localhost:9200/_cat/indices?v"
echo ""
