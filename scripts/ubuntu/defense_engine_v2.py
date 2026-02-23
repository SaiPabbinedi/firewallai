#!/usr/bin/env python3
"""
Defense Engine V2 - Real-time Analytics with Spark Structured Streaming
========================================================================
Implements the analytics layer from the research paper:
- Real-time log processing from Kafka
- Feature extraction and enrichment
- ML-based anomaly detection (Isolation Forest)
- Threat classification (Random Forest)
- LLM integration for natural language explanations
- ** NEW: Pushes ML metrics to Kafka/Elasticsearch for Grafana dashboards **

Requirements:
    pip install pyspark kafka-python scikit-learn requests pandas numpy elasticsearch
"""

import json
import time
import signal
import sys
import logging
import uuid
from datetime import datetime, timedelta
from collections import defaultdict
import threading

# Spark imports
from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col, from_json, window, count, avg, sum as spark_sum,
    expr, lit, when, struct, to_json, current_timestamp,
    udf, explode, split, regexp_extract
)
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType,
    TimestampType, FloatType, BooleanType, ArrayType, MapType
)

# ML imports
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import numpy as np
import pandas as pd

# HTTP for Ollama integration + Elasticsearch
import requests

# Kafka producer
from kafka import KafkaProducer
from kafka.errors import NoBrokersAvailable

# ===========================================
# Configuration
# ===========================================
KAFKA_BOOTSTRAP = 'localhost:9092'
OLLAMA_URL = 'http://localhost:11434'
OLLAMA_MODEL = 'llama3.2:3b'
ELASTICSEARCH_URL = 'http://localhost:9200'

# AlienVault OTX — free threat intelligence API (Zero RAM)
OTX_API_URL = 'https://otx.alienvault.com/api/v1'

# GeoIP — MaxMind GeoLite2 City flat-file (60MB, zero-RAM lookup)
GEOIP_DB_PATH = '/opt/firewallai/GeoLite2-City.mmdb'

# MITRE ATT&CK Mapping (classification → technique ID)
MITRE_ATTACK_MAPPING = {
    'port_scan':    {'id': 'T1046', 'name': 'Network Service Discovery', 'tactic': 'Discovery'},
    'brute_force':  {'id': 'T1110', 'name': 'Brute Force', 'tactic': 'Credential Access'},
    'ddos':         {'id': 'T1498', 'name': 'Network Denial of Service', 'tactic': 'Impact'},
    'web_attack':   {'id': 'T1190', 'name': 'Exploit Public-Facing App', 'tactic': 'Initial Access'},
    'ssh_anomaly':  {'id': 'T1021.004', 'name': 'Remote Services: SSH', 'tactic': 'Lateral Movement'},
    'dns_tunnel':   {'id': 'T1071.004', 'name': 'App Layer Protocol: DNS', 'tactic': 'C2'},
    'data_exfiltration': {'id': 'T1041', 'name': 'Exfiltration Over C2', 'tactic': 'Exfiltration'},
    'reconnaissance': {'id': 'T1595', 'name': 'Active Scanning', 'tactic': 'Reconnaissance'},
    'malware':      {'id': 'T1204', 'name': 'User Execution', 'tactic': 'Execution'},
    'suspicious':   {'id': 'T1595', 'name': 'Active Scanning', 'tactic': 'Reconnaissance'},
}

# Anomaly detection thresholds
ANOMALY_THRESHOLD = -0.5  # Isolation Forest score threshold
THREAT_SCORE_HIGH = 0.8
THREAT_SCORE_MEDIUM = 0.5

# Sliding window configurations
WINDOW_DURATION = "5 minutes"
SLIDING_INTERVAL = "1 minute"

# Metrics publishing interval (seconds)
METRICS_PUBLISH_INTERVAL = 15

# ===========================================
# Logging Setup
# ===========================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('DefenseEngine')

# ===========================================
# Schema Definitions
# ===========================================
FIREWALL_LOG_SCHEMA = StructType([
    StructField("timestamp", StringType(), True),
    StructField("source_collector", StringType(), True),
    StructField("severity", StringType(), True),
    StructField("raw_message", StringType(), True),
    StructField("parsed", MapType(StringType(), StringType()), True),
    StructField("enriched_at", StringType(), True)
])

SURICATA_ALERT_SCHEMA = StructType([
    StructField("timestamp", StringType(), True),
    StructField("event_type", StringType(), True),
    StructField("src_ip", StringType(), True),
    StructField("src_port", IntegerType(), True),
    StructField("dest_ip", StringType(), True),
    StructField("dest_port", IntegerType(), True),
    StructField("proto", StringType(), True),
    StructField("alert", StructType([
        StructField("signature", StringType(), True),
        StructField("signature_id", IntegerType(), True),
        StructField("severity", IntegerType(), True),
        StructField("category", StringType(), True)
    ]), True)
])

# ===========================================
# Metrics Tracker (NEW)
# ===========================================
class MetricsTracker:
    """Tracks all ML/AI metrics for Grafana visualization"""

    def __init__(self):
        self.lock = threading.Lock()
        self._reset_window()
        self.cumulative = {
            'total_anomalies': 0,
            'total_rules_generated': 0,
            'total_sessions_analyzed': 0,
            'total_events_processed': 0
        }
        # Rolling history for averages
        self.mttr_history = []
        self.llm_latency_history = []
        self.confidence_history = []
        self.anomaly_scores_history = []

    def _reset_window(self):
        """Reset per-window counters"""
        self.window = {
            'anomalies_detected': 0,
            'rules_generated': 0,
            'auto_blocks': 0,
            'manual_blocks': 0,
            'events_per_second': 0,
            'window_start': datetime.utcnow().isoformat()
        }

    def record_anomaly(self, score, ip, classification, confidence):
        with self.lock:
            self.window['anomalies_detected'] += 1
            self.cumulative['total_anomalies'] += 1
            self.anomaly_scores_history.append({
                'score': score, 'ip': ip, 'ts': time.time()
            })
            self.confidence_history.append({
                'classification': classification,
                'confidence': confidence,
                'ts': time.time()
            })
            # Keep last 1000 entries
            self.anomaly_scores_history = self.anomaly_scores_history[-1000:]
            self.confidence_history = self.confidence_history[-1000:]

    def record_llm_latency(self, latency_ms):
        with self.lock:
            self.llm_latency_history.append({
                'latency_ms': latency_ms, 'ts': time.time()
            })
            self.llm_latency_history = self.llm_latency_history[-500:]

    def record_mttr(self, mttr_seconds):
        with self.lock:
            self.mttr_history.append({
                'mttr_seconds': mttr_seconds, 'ts': time.time()
            })
            self.mttr_history = self.mttr_history[-500:]

    def record_rule_generated(self, is_automated=True):
        with self.lock:
            self.window['rules_generated'] += 1
            self.cumulative['total_rules_generated'] += 1
            if is_automated:
                self.window['auto_blocks'] += 1
            else:
                self.window['manual_blocks'] += 1

    def record_events(self, count):
        with self.lock:
            self.cumulative['total_events_processed'] += count

    def get_snapshot(self):
        """Get a metrics snapshot for publishing"""
        with self.lock:
            now = time.time()
            one_hour = now - 3600
            twenty_four_hours = now - 86400

            # Calculate averages from recent history
            recent_mttr = [m['mttr_seconds'] for m in self.mttr_history if m['ts'] > one_hour]
            recent_llm = [m['latency_ms'] for m in self.llm_latency_history if m['ts'] > one_hour]
            recent_confidence = [c['confidence'] for c in self.confidence_history if c['ts'] > one_hour]
            recent_scores = [s['score'] for s in self.anomaly_scores_history if s['ts'] > one_hour]

            return {
                '@timestamp': datetime.utcnow().isoformat() + 'Z',
                'metric_type': 'engine_snapshot',

                # Anomaly Detection
                'anomalies_detected_window': self.window['anomalies_detected'],
                'anomalies_detected_total': self.cumulative['total_anomalies'],
                'avg_anomaly_score': float(np.mean(recent_scores)) if recent_scores else 0.0,
                'anomaly_score_min': float(min(recent_scores)) if recent_scores else 0.0,
                'anomaly_score_max': float(max(recent_scores)) if recent_scores else 0.0,

                # Threat Classification
                'avg_classification_confidence': float(np.mean(recent_confidence)) if recent_confidence else 0.0,

                # LLM Performance
                'avg_llm_latency_ms': float(np.mean(recent_llm)) if recent_llm else 0.0,
                'max_llm_latency_ms': float(max(recent_llm)) if recent_llm else 0.0,
                'min_llm_latency_ms': float(min(recent_llm)) if recent_llm else 0.0,

                # MTTR (Mean Time to Respond)
                'avg_mttr_seconds': float(np.mean(recent_mttr)) if recent_mttr else 0.0,
                'min_mttr_seconds': float(min(recent_mttr)) if recent_mttr else 0.0,
                'max_mttr_seconds': float(max(recent_mttr)) if recent_mttr else 0.0,
                'sub_3s_response_rate': (
                    len([m for m in recent_mttr if m < 3.0]) / len(recent_mttr) * 100
                    if recent_mttr else 0.0
                ),

                # Rule Generation
                'rules_generated_window': self.window['rules_generated'],
                'rules_generated_total': self.cumulative['total_rules_generated'],
                'auto_blocks': self.window['auto_blocks'],
                'manual_blocks': self.window['manual_blocks'],

                # Pipeline
                'events_processed_total': self.cumulative['total_events_processed'],
                'events_per_second': self.window['events_per_second'],
                'sessions_analyzed_total': self.cumulative['total_sessions_analyzed'],

                'source': 'defense_engine'
            }


# ===========================================
# ML Model Manager
# ===========================================
class MLModelManager:
    """Manages ML models for threat detection"""

    def __init__(self):
        self.isolation_forest = None
        self.random_forest = None
        self.scaler = StandardScaler()
        self.feature_columns = [
            'packet_count', 'byte_count', 'unique_ports',
            'unique_ips', 'block_ratio', 'time_variance'
        ]
        self.is_trained = False
        self.threat_labels = [
            'normal', 'port_scan', 'brute_force', 'ddos', 'web_attack', 'dns_tunnel'
        ]

    def train_isolation_forest(self, training_data):
        """Train the Isolation Forest model for anomaly detection"""
        logger.info("Training Isolation Forest model...")

        self.isolation_forest = IsolationForest(
            n_estimators=100,
            contamination=0.1,
            random_state=42,
            n_jobs=-1
        )

        scaled_data = self.scaler.fit_transform(training_data)
        self.isolation_forest.fit(scaled_data)

        logger.info("Isolation Forest training complete")
        self.is_trained = True

    def train_random_forest(self, features, labels):
        """Train Random Forest for threat classification"""
        logger.info("Training Random Forest classifier...")

        self.random_forest = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )

        scaled_features = self.scaler.transform(features)
        self.random_forest.fit(scaled_features, labels)

        logger.info("Random Forest training complete")

    def predict_anomaly(self, features):
        """Predict if a sample is an anomaly"""
        if not self.is_trained or self.isolation_forest is None:
            return 0.0, False

        scaled = self.scaler.transform([features])
        score = self.isolation_forest.decision_function(scaled)[0]
        is_anomaly = score < ANOMALY_THRESHOLD

        return float(score), is_anomaly

    def classify_threat(self, features):
        """Classify the type of threat"""
        if self.random_forest is None:
            # Heuristic classification when RF not trained
            return self._heuristic_classify(features)

        scaled = self.scaler.transform([features])
        prediction = self.random_forest.predict(scaled)[0]
        probabilities = self.random_forest.predict_proba(scaled)[0]
        confidence = float(max(probabilities))

        return prediction, confidence

    def _heuristic_classify(self, features):
        """Heuristic classification based on feature patterns"""
        packet_count, blocked_count, unique_ports, unique_ips, block_ratio, time_span = features

        if unique_ports > 20:
            return 'port_scan', 0.85
        elif blocked_count > 50 and block_ratio > 0.8 and unique_ports <= 3:
            return 'brute_force', 0.80
        elif packet_count > 500 and time_span < 60:
            return 'ddos', 0.75
        elif unique_ports <= 3 and any(p in [80, 443, 8080] for p in []):
            return 'web_attack', 0.70
        else:
            return 'suspicious', 0.60


# ===========================================
# LLM Integration
# ===========================================
class GemmaAnalyzer:
    """LLM-based threat analysis using Ollama"""

    def __init__(self, url=OLLAMA_URL, model=OLLAMA_MODEL):
        self.url = url
        self.model = model
        self.available = self._check_availability()

    def _check_availability(self):
        """Check if Ollama is available"""
        try:
            response = requests.get(f"{self.url}/api/tags", timeout=5)
            if response.status_code == 200:
                models = response.json().get('models', [])
                logger.info(f"Ollama available with {len(models)} models")
                return True
        except Exception:
            logger.warning("Ollama not available - LLM analysis disabled")
        return False

    def analyze_session(self, session_data):
        """Analyze a suspicious session and generate explanation"""
        if not self.available:
            return self._generate_fallback_analysis(session_data)

        prompt = f"""Analyze this network security session and provide a threat assessment:

Session Data:
- Source IP: {session_data.get('src_ip', 'N/A')}
- Destination IP: {session_data.get('dst_ip', 'N/A')}
- Protocol: {session_data.get('protocol', 'N/A')}
- Packet Count: {session_data.get('packet_count', 0)}
- Blocked Packets: {session_data.get('blocked_count', 0)}
- Time Span: {session_data.get('time_span', 'N/A')}
- Anomaly Score: {session_data.get('anomaly_score', 'N/A')}
- Classification: {session_data.get('classification', 'N/A')}

Provide:
1. Threat assessment (Critical/High/Medium/Low)
2. Attack type identification
3. Recommended action
4. Brief explanation

Respond in JSON format only:
{{"threat_level": "...", "attack_type": "...", "action": "block", "explanation": "...", "recommendation": "..."}}
"""

        try:
            response = requests.post(
                f"{self.url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1}
                },
                timeout=30
            )

            if response.status_code == 200:
                result = response.json().get('response', '')
                import re
                json_match = re.search(r'\{[^}]+\}', result)
                if json_match:
                    return json.loads(json_match.group())

        except Exception as e:
            logger.error(f"LLM analysis error: {e}")

        return self._generate_fallback_analysis(session_data)

    def _generate_fallback_analysis(self, session_data):
        """Generate a rule-based analysis when LLM is unavailable"""
        classification = session_data.get('classification', 'suspicious')
        score = session_data.get('anomaly_score', 0)

        threat_map = {
            'port_scan': ('High', 'Port Scanning', 'Systematic port enumeration detected'),
            'brute_force': ('Critical', 'Brute Force Attack', 'Repeated authentication attempts'),
            'ddos': ('Critical', 'DDoS Attack', 'High-volume traffic flood detected'),
            'web_attack': ('High', 'Web Application Attack', 'Malicious web requests detected'),
            'dns_tunnel': ('Medium', 'DNS Tunneling', 'Suspicious DNS query patterns'),
            'suspicious': ('Medium', 'Suspicious Activity', 'Anomalous network behavior detected'),
        }

        level, attack_type, explanation = threat_map.get(
            classification, ('Medium', 'Unknown', 'Anomalous behavior')
        )

        return {
            'threat_level': level,
            'attack_type': attack_type,
            'action': 'block',
            'explanation': explanation,
            'recommendation': f'Block source IP {session_data.get("src_ip", "unknown")}'
        }

    def generate_rule_recommendation(self, threat_data):
        """Generate firewall rule recommendation from threat data"""
        if not self.available:
            # Return a deterministic rule when LLM unavailable
            ip = threat_data.get('ip', '')
            return {
                "type": "ip",
                "target": ip,
                "action": "block",
                "interface": "both",
                "reason": f"Anomalous activity detected (score: {threat_data.get('features', [0])[0]:.2f})"
            }

        prompt = f"""Based on this detected threat, generate a pfSense firewall rule:

Threat Data:
{json.dumps(threat_data, indent=2)}

Generate a JSON rule in this format:
{{"type": "ip|domain", "target": "...", "action": "block|allow", "interface": "wan|lan|both", "reason": "..."}}
"""

        try:
            response = requests.post(
                f"{self.url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0.1}
                },
                timeout=30
            )

            if response.status_code == 200:
                result = response.json().get('response', '')
                return json.loads(result)

        except Exception as e:
            logger.error(f"Rule generation error: {e}")

        return None


# ===========================================
# Threat Aggregator
# ===========================================
class ThreatAggregator:
    """Aggregates and tracks threats in sliding windows"""

    def __init__(self):
        self.ip_stats = defaultdict(lambda: {
            'packet_count': 0,
            'blocked_count': 0,
            'ports_accessed': set(),
            'first_seen': None,
            'last_seen': None,
            'protocols': set(),
            'alert_timestamps': []
        })
        self.lock = threading.Lock()
        self.events_in_window = 0

    def update(self, log_data):
        """Update stats from a new log entry"""
        with self.lock:
            src_ip = log_data.get('src_ip')
            if not src_ip:
                return

            stats = self.ip_stats[src_ip]
            stats['packet_count'] += 1
            self.events_in_window += 1

            if log_data.get('action', '').lower() in ['block', 'drop', 'reject']:
                stats['blocked_count'] += 1

            if log_data.get('dst_port'):
                stats['ports_accessed'].add(log_data['dst_port'])

            if log_data.get('protocol'):
                stats['protocols'].add(log_data['protocol'])

            now = datetime.utcnow()
            if not stats['first_seen']:
                stats['first_seen'] = now
            stats['last_seen'] = now

            # Track alert timestamps for MTTR calculation
            if log_data.get('is_alert'):
                stats['alert_timestamps'].append(now)

    def get_events_per_second(self):
        """Get current EPS"""
        with self.lock:
            eps = self.events_in_window / max(METRICS_PUBLISH_INTERVAL, 1)
            self.events_in_window = 0
            return eps

    def get_features(self, ip):
        """Extract features for ML model input"""
        with self.lock:
            stats = self.ip_stats.get(ip)
            if not stats:
                return None

            time_span = (stats['last_seen'] - stats['first_seen']).total_seconds() if stats['first_seen'] else 0

            return [
                stats['packet_count'],
                stats['blocked_count'],
                len(stats['ports_accessed']),
                1,
                stats['blocked_count'] / max(stats['packet_count'], 1),
                time_span
            ]

    def get_session_data(self, ip):
        """Get session data for LLM analysis"""
        with self.lock:
            stats = self.ip_stats.get(ip)
            if not stats:
                return None

            return {
                'src_ip': ip,
                'packet_count': stats['packet_count'],
                'blocked_count': stats['blocked_count'],
                'unique_ports': len(stats['ports_accessed']),
                'protocols': list(stats['protocols']),
                'time_span': str(stats['last_seen'] - stats['first_seen']) if stats['first_seen'] else 'N/A'
            }

    def get_earliest_alert_time(self, ip):
        """Get the earliest alert timestamp for MTTR calculation"""
        with self.lock:
            stats = self.ip_stats.get(ip)
            if stats and stats['alert_timestamps']:
                return stats['alert_timestamps'][0]
            return None

    def cleanup_old(self, max_age_minutes=30):
        """Remove old entries to prevent memory bloat"""
        with self.lock:
            cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
            to_remove = [
                ip for ip, stats in self.ip_stats.items()
                if stats['last_seen'] and stats['last_seen'] < cutoff
            ]
            for ip in to_remove:
                del self.ip_stats[ip]


# ===========================================
# Elasticsearch Direct Publisher (NEW)
# ===========================================
class ElasticsearchPublisher:
    """Publishes metrics directly to Elasticsearch when Kafka is unavailable"""

    def __init__(self, url=ELASTICSEARCH_URL):
        self.url = url
        self.available = self._check()

    def _check(self):
        try:
            r = requests.get(self.url, timeout=3)
            return r.status_code == 200
        except Exception:
            return False

    def publish(self, index, doc):
        """Publish a single document to ES"""
        if not self.available:
            return False
        try:
            r = requests.post(
                f"{self.url}/{index}/_doc",
                json=doc,
                headers={'Content-Type': 'application/json'},
                timeout=5
            )
            return r.status_code in [200, 201]
        except Exception as e:
            logger.debug(f"ES publish error: {e}")
            return False

    def bulk_publish(self, index, docs):
        """Publish multiple documents to ES via bulk API"""
        if not self.available or not docs:
            return False
        try:
            bulk_body = ""
            for doc in docs:
                bulk_body += json.dumps({"index": {"_index": index}}) + "\n"
                bulk_body += json.dumps(doc) + "\n"

            r = requests.post(
                f"{self.url}/_bulk",
                data=bulk_body,
                headers={'Content-Type': 'application/x-ndjson'},
                timeout=10
            )
            return r.status_code == 200
        except Exception as e:
            logger.debug(f"ES bulk error: {e}")
            return False


# ===========================================
# Threat Intelligence Enricher (NEW - Zero RAM)
# ===========================================
class ThreatIntelEnricher:
    """Enriches threats with external intelligence — zero server RAM cost.
    
    Uses:
    - AlienVault OTX API (free, cloud-based) for IP reputation
    - MaxMind GeoLite2 flat-file (60MB) for geolocation
    - MITRE ATT&CK mapping (in-memory dict, <1KB)
    """

    def __init__(self):
        self.geoip_reader = None
        self._init_geoip()
        self._otx_cache = {}  # {ip: {data, timestamp}}
        self._cache_ttl = 3600  # 1 hour

    def _init_geoip(self):
        """Initialize GeoIP reader from MaxMind flat-file"""
        try:
            import geoip2.database
            self.geoip_reader = geoip2.database.Reader(GEOIP_DB_PATH)
            logger.info(f"GeoIP database loaded from {GEOIP_DB_PATH}")
        except ImportError:
            logger.warning("geoip2 not installed — run: pip install geoip2")
        except FileNotFoundError:
            logger.warning(f"GeoIP DB not found at {GEOIP_DB_PATH} — geo enrichment disabled")
            logger.info("Download from: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data")
        except Exception as e:
            logger.warning(f"GeoIP init error: {e}")

    def get_geo(self, ip):
        """Resolve IP to latitude/longitude/country using local flat-file DB.
        Returns dict with lat, lng, country, country_code, city."""
        if not self.geoip_reader:
            return None
        try:
            response = self.geoip_reader.city(ip)
            return {
                'lat': response.location.latitude,
                'lng': response.location.longitude,
                'country': response.country.name or 'Unknown',
                'country_code': response.country.iso_code or 'XX',
                'city': response.city.name or ''
            }
        except Exception:
            return None

    def get_otx_reputation(self, ip):
        """Query AlienVault OTX for IP reputation (cloud API, zero RAM).
        Returns dict with reputation score, pulse count, tags."""
        # Check cache first
        if ip in self._otx_cache:
            cached = self._otx_cache[ip]
            if time.time() - cached['timestamp'] < self._cache_ttl:
                return cached['data']

        try:
            response = requests.get(
                f"{OTX_API_URL}/indicators/IPv4/{ip}/general",
                timeout=5,
                headers={'Accept': 'application/json'}
            )
            if response.status_code == 200:
                d = response.json()
                result = {
                    'reputation': d.get('reputation', 0),
                    'pulse_count': d.get('pulse_info', {}).get('count', 0),
                    'country': d.get('country_name', 'Unknown'),
                    'asn': d.get('asn', 'Unknown'),
                    'tags': [p.get('name', '') for p in d.get('pulse_info', {}).get('pulses', [])[:5]]
                }
                self._otx_cache[ip] = {'data': result, 'timestamp': time.time()}
                return result
        except Exception as e:
            logger.debug(f"OTX lookup failed for {ip}: {e}")

        return {'reputation': 0, 'pulse_count': 0, 'country': 'Unknown', 'asn': 'Unknown', 'tags': []}

    def get_mitre_technique(self, classification):
        """Map a threat classification to MITRE ATT&CK technique."""
        return MITRE_ATTACK_MAPPING.get(classification, MITRE_ATTACK_MAPPING.get('suspicious'))

    def enrich_threat(self, ip, classification):
        """Full enrichment: GeoIP + OTX + MITRE mapping."""
        result = {
            'mitre': self.get_mitre_technique(classification),
            'geo': self.get_geo(ip),
            'otx': self.get_otx_reputation(ip)
        }
        return result


# ===========================================
# Main Defense Engine
# ===========================================
class DefenseEngine:
    """Main orchestrator for the defense analytics pipeline"""

    def __init__(self):
        self.running = True
        self.ml_manager = MLModelManager()
        self.llm_analyzer = GemmaAnalyzer()
        self.threat_aggregator = ThreatAggregator()
        self.metrics_tracker = MetricsTracker()
        self.es_publisher = ElasticsearchPublisher()
        self.threat_enricher = ThreatIntelEnricher()  # NEW: zero-RAM enricher
        self.kafka_producer = None
        self.spark = None

    def init_kafka_producer(self):
        """Initialize Kafka producer for metrics output"""
        try:
            self.kafka_producer = KafkaProducer(
                bootstrap_servers=KAFKA_BOOTSTRAP,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                acks='all',
                retries=3,
                linger_ms=50
            )
            logger.info("Kafka producer initialized for metrics output")
        except NoBrokersAvailable:
            logger.warning("Kafka not available - publishing directly to ES")

    def publish_to_kafka_and_es(self, topic, doc):
        """Publish to Kafka (preferred) and/or directly to ES"""
        # Try Kafka first
        if self.kafka_producer:
            try:
                self.kafka_producer.send(topic, value=doc)
            except Exception as e:
                logger.debug(f"Kafka send error: {e}")

        # Also publish directly to ES for reliability
        index_map = {
            'ai-analysis': 'threat-sessions',
            'ai-metrics': 'ai-metrics'
        }
        es_index = index_map.get(topic, topic)
        self.es_publisher.publish(es_index, doc)

    def initialize_spark(self):
        """Initialize Spark session"""
        logger.info("Initializing Spark session...")

        self.spark = SparkSession.builder \
            .appName("CyberDefenseEngine") \
            .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0") \
            .config("spark.sql.streaming.checkpointLocation", "/tmp/spark_checkpoint") \
            .config("spark.driver.memory", "2g") \
            .config("spark.executor.memory", "2g") \
            .config("spark.sql.shuffle.partitions", "4") \
            .getOrCreate()

        self.spark.sparkContext.setLogLevel("WARN")
        logger.info("Spark session initialized")

    def process_firewall_stream(self):
        """Process firewall logs from Kafka"""
        logger.info("Starting firewall log stream processing...")

        df = self.spark \
            .readStream \
            .format("kafka") \
            .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP) \
            .option("subscribe", "firewall-logs") \
            .option("startingOffsets", "latest") \
            .load()

        parsed = df.select(
            from_json(col("value").cast("string"), FIREWALL_LOG_SCHEMA).alias("data"),
            col("timestamp").alias("kafka_timestamp")
        ).select("data.*", "kafka_timestamp")

        windowed = parsed \
            .withWatermark("kafka_timestamp", "10 minutes") \
            .groupBy(
                window(col("kafka_timestamp"), WINDOW_DURATION, SLIDING_INTERVAL),
                col("severity")
            ) \
            .agg(
                count("*").alias("event_count"),
                expr("collect_set(parsed['src_ip'])").alias("unique_sources")
            )

        query = windowed.writeStream \
            .outputMode("update") \
            .format("console") \
            .option("truncate", False) \
            .trigger(processingTime="30 seconds") \
            .start()

        return query

    def process_suricata_stream(self):
        """Process Suricata alerts from Kafka"""
        logger.info("Starting Suricata alert stream processing...")

        df = self.spark \
            .readStream \
            .format("kafka") \
            .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP) \
            .option("subscribe", "suricata-alerts") \
            .option("startingOffsets", "latest") \
            .load()

        parsed = df.select(
            from_json(col("value").cast("string"), SURICATA_ALERT_SCHEMA).alias("data"),
            col("timestamp").alias("kafka_timestamp")
        ).select("data.*", "kafka_timestamp")

        alerts = parsed.filter(col("event_type") == "alert")

        windowed_alerts = alerts \
            .withWatermark("kafka_timestamp", "5 minutes") \
            .groupBy(
                window(col("kafka_timestamp"), "5 minutes", "1 minute"),
                col("src_ip"),
                col("alert.category")
            ) \
            .agg(
                count("*").alias("alert_count"),
                expr("collect_list(alert.signature)").alias("signatures")
            )

        query = windowed_alerts.writeStream \
            .outputMode("update") \
            .format("console") \
            .trigger(processingTime="10 seconds") \
            .start()

        return query

    def run_ml_analysis(self):
        """Run periodic ML analysis on aggregated data"""
        logger.info("Starting ML analysis loop...")

        while self.running:
            try:
                self.threat_aggregator.cleanup_old()

                for ip, stats in list(self.threat_aggregator.ip_stats.items()):
                    if stats['packet_count'] < 10:
                        continue

                    features = self.threat_aggregator.get_features(ip)
                    if not features:
                        continue

                    # ML Anomaly Detection
                    score, is_anomaly = self.ml_manager.predict_anomaly(features)

                    # Always publish anomaly scores (for distribution histogram)
                    score_doc = {
                        '@timestamp': datetime.utcnow().isoformat() + 'Z',
                        'metric_type': 'anomaly_score',
                        'src_ip': ip,
                        'anomaly_score': score,
                        'is_anomaly': is_anomaly,
                        'packet_count': features[0],
                        'blocked_count': features[1],
                        'unique_ports': features[2],
                        'block_ratio': features[4],
                        'source': 'defense_engine'
                    }
                    self.publish_to_kafka_and_es('ai-metrics', score_doc)

                    if is_anomaly:
                        detection_start = time.time()
                        logger.warning(f"🚨 ANOMALY DETECTED: {ip} (score: {score:.3f})")

                        # Classify the threat
                        threat_type, confidence = self.ml_manager.classify_threat(features)
                        self.metrics_tracker.record_anomaly(score, ip, threat_type, confidence)

                        # LLM Analysis with latency tracking
                        session_data = self.threat_aggregator.get_session_data(ip)
                        session_data['anomaly_score'] = score
                        session_data['classification'] = threat_type

                        llm_start = time.time()
                        llm_result = self.llm_analyzer.analyze_session(session_data)
                        llm_latency = (time.time() - llm_start) * 1000
                        self.metrics_tracker.record_llm_latency(llm_latency)

                        logger.info(f"LLM Analysis ({llm_latency:.0f}ms): {json.dumps(llm_result)}")

                        # Generate rule recommendation
                        rule = self.llm_analyzer.generate_rule_recommendation({
                            'ip': ip,
                            'analysis': llm_result,
                            'features': features
                        })

                        # Calculate MTTR
                        alert_time = self.threat_aggregator.get_earliest_alert_time(ip)
                        mttr_seconds = (datetime.utcnow() - alert_time).total_seconds() if alert_time else (time.time() - detection_start)
                        self.metrics_tracker.record_mttr(mttr_seconds)

                        if rule:
                            self.metrics_tracker.record_rule_generated(is_automated=True)
                            logger.info(f"🛡️ Recommended Rule: {json.dumps(rule)}")

                        # NEW: Enrich threat with MITRE + GeoIP + OTX
                        enrichment = self.threat_enricher.enrich_threat(ip, threat_type)

                        # Publish full threat session to ES (now enriched)
                        threat_doc = {
                            '@timestamp': datetime.utcnow().isoformat() + 'Z',
                            'session_id': str(uuid.uuid4()),
                            'src_ip': ip,
                            'anomaly_score': score,
                            'is_anomaly': True,
                            'threat_classification': threat_type,
                            'threat_confidence': confidence,
                            'packet_count': int(features[0]),
                            'unique_ports': int(features[2]),
                            'protocols': list(self.threat_aggregator.ip_stats.get(ip, {}).get('protocols', [])),
                            'llm_analysis': llm_result,
                            'llm_latency_ms': llm_latency,
                            'mttr_seconds': mttr_seconds,
                            # NEW enrichments
                            'mitre_technique': enrichment['mitre'],
                            'geo': enrichment['geo'],
                            'otx_reputation': enrichment['otx'],
                            'automated_action': {
                                'type': rule.get('type', 'ip') if rule else None,
                                'target': rule.get('target', ip) if rule else ip,
                                'status': 'recommended',
                                'applied_at': datetime.utcnow().isoformat() + 'Z'
                            } if rule else None,
                            'source': 'defense_engine'
                        }
                        self.publish_to_kafka_and_es('ai-analysis', threat_doc)

                        # Publish MTTR metric
                        mttr_doc = {
                            '@timestamp': datetime.utcnow().isoformat() + 'Z',
                            'metric_type': 'mttr',
                            'mttr_seconds': mttr_seconds,
                            'src_ip': ip,
                            'classification': threat_type,
                            'is_automated': True,
                            'source': 'defense_engine'
                        }
                        self.publish_to_kafka_and_es('ai-metrics', mttr_doc)

                self.metrics_tracker.cumulative['total_sessions_analyzed'] += 1
                time.sleep(30)

            except Exception as e:
                logger.error(f"ML analysis error: {e}")
                time.sleep(10)

    def publish_metrics_loop(self):
        """Periodically publish aggregated metrics snapshot"""
        logger.info("Starting metrics publisher loop...")

        while self.running:
            try:
                # Update EPS
                eps = self.threat_aggregator.get_events_per_second()
                self.metrics_tracker.window['events_per_second'] = eps

                # Get full snapshot
                snapshot = self.metrics_tracker.get_snapshot()
                self.publish_to_kafka_and_es('ai-metrics', snapshot)

                logger.info(
                    f"📊 Metrics: anomalies={snapshot['anomalies_detected_total']} "
                    f"rules={snapshot['rules_generated_total']} "
                    f"MTTR={snapshot['avg_mttr_seconds']:.1f}s "
                    f"LLM={snapshot['avg_llm_latency_ms']:.0f}ms "
                    f"EPS={snapshot['events_per_second']:.0f}"
                )

            except Exception as e:
                logger.error(f"Metrics publish error: {e}")

            time.sleep(METRICS_PUBLISH_INTERVAL)

    def start(self):
        """Start the defense engine"""
        print("╔═══════════════════════════════════════════════════════════════╗")
        print("║   CYBER DEFENSE ENGINE v2.1 - AI-Powered Analytics + Metrics ║")
        print("╚═══════════════════════════════════════════════════════════════╝")
        print("")

        # Initialize Kafka producer for metrics
        self.init_kafka_producer()

        # Initialize Spark
        self.initialize_spark()

        # Generate synthetic training data for initial model
        logger.info("Initializing ML models with baseline data...")
        np.random.seed(42)
        training_data = np.random.randn(1000, 6) * [100, 10, 5, 10, 0.1, 60]
        training_data = np.abs(training_data)
        self.ml_manager.train_isolation_forest(training_data)

        # Train Random Forest with synthetic labeled data
        logger.info("Training threat classifier with baseline patterns...")
        rf_features = np.vstack([
            np.random.randn(200, 6) * [50, 5, 3, 5, 0.05, 120] + [50, 5, 3, 5, 0.05, 120],  # normal
            np.random.randn(50, 6) * [20, 2, 15, 3, 0.1, 30] + [30, 3, 25, 3, 0.1, 30],     # port_scan
            np.random.randn(50, 6) * [10, 40, 1, 1, 0.2, 300] + [100, 80, 1, 1, 0.8, 600],   # brute_force
            np.random.randn(50, 6) * [500, 10, 2, 2, 0.05, 5] + [1000, 10, 2, 2, 0.01, 10],  # ddos
            np.random.randn(50, 6) * [20, 5, 2, 2, 0.1, 60] + [30, 10, 2, 2, 0.3, 120],      # web_attack
        ])
        rf_features = np.abs(rf_features)
        rf_labels = (['normal'] * 200 + ['port_scan'] * 50 +
                     ['brute_force'] * 50 + ['ddos'] * 50 + ['web_attack'] * 50)
        self.ml_manager.train_random_forest(rf_features, rf_labels)

        # Start streaming queries
        queries = []

        try:
            fw_query = self.process_firewall_stream()
            queries.append(fw_query)
        except Exception as e:
            logger.warning(f"Could not start firewall stream: {e}")

        try:
            sur_query = self.process_suricata_stream()
            queries.append(sur_query)
        except Exception as e:
            logger.warning(f"Could not start Suricata stream: {e}")

        # Start ML analysis in background thread
        ml_thread = threading.Thread(target=self.run_ml_analysis, daemon=True)
        ml_thread.start()

        # Start metrics publisher in background thread
        metrics_thread = threading.Thread(target=self.publish_metrics_loop, daemon=True)
        metrics_thread.start()

        logger.info("✅ Defense Engine running with Metrics Pipeline. Press Ctrl+C to stop.")

        # Wait for queries
        try:
            if queries:
                for query in queries:
                    query.awaitTermination()
            else:
                # No Spark queries - just keep running for ML analysis
                while self.running:
                    time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            self.running = False
            for query in queries:
                query.stop()
            if self.spark:
                self.spark.stop()
            if self.kafka_producer:
                self.kafka_producer.flush()
                self.kafka_producer.close()


# ===========================================
# Entry Point
# ===========================================
def main():
    engine = DefenseEngine()

    def signal_handler(sig, frame):
        engine.running = False
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    engine.start()

if __name__ == '__main__':
    main()
