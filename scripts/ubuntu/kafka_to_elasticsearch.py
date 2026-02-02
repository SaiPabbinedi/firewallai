#!/usr/bin/env python3
"""
Kafka to Elasticsearch Connector
================================
Streams data from Kafka topics to Elasticsearch indices
with proper mapping and error handling.

Usage:
    python3 kafka_to_elasticsearch.py

Requirements:
    pip install kafka-python elasticsearch
"""

import json
import signal
import sys
import logging
from datetime import datetime
from typing import Dict, Any, Optional

from kafka import KafkaConsumer
from elasticsearch import Elasticsearch, helpers

# ===========================================
# Configuration
# ===========================================
KAFKA_BOOTSTRAP = 'localhost:9092'
ELASTICSEARCH_URL = 'http://localhost:9200'

# Topic to Index mapping
TOPIC_INDEX_MAP = {
    'firewall-logs': 'firewall-events',
    'suricata-alerts': 'suricata-alerts',
    'threat-intel': 'threat-sessions',
    'ai-analysis': 'threat-sessions',
    'automation-audit': 'audit-logs'
}

BATCH_SIZE = 100
FLUSH_INTERVAL = 5  # seconds

# ===========================================
# Logging Setup
# ===========================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('KafkaToES')

# ===========================================
# Document Transformer
# ===========================================
class DocumentTransformer:
    """Transforms Kafka messages to Elasticsearch documents"""
    
    @staticmethod
    def transform_firewall_log(data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform firewall log to ES document"""
        parsed = data.get('parsed', {})
        
        doc = {
            '@timestamp': data.get('timestamp') or datetime.utcnow().isoformat(),
            'src_ip': parsed.get('src_ip'),
            'dst_ip': parsed.get('dst_ip'),
            'src_port': int(parsed.get('src_port', 0)) if parsed.get('src_port') else None,
            'dst_port': int(parsed.get('dst_port', 0)) if parsed.get('dst_port') else None,
            'protocol': parsed.get('protocol'),
            'action': parsed.get('action'),
            'interface': parsed.get('interface'),
            'direction': parsed.get('direction'),
            'reason': parsed.get('reason'),
            'bytes': int(parsed.get('length', 0)) if parsed.get('length') else None,
            'rule_id': parsed.get('rule_number'),
            'raw_message': data.get('raw_message', '')[:1000]  # Truncate for storage
        }
        
        # Remove None values
        return {k: v for k, v in doc.items() if v is not None}
    
    @staticmethod
    def transform_suricata_alert(data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Suricata EVE JSON to ES document"""
        alert = data.get('alert', {})
        
        doc = {
            '@timestamp': data.get('timestamp') or datetime.utcnow().isoformat(),
            'event_type': data.get('event_type', 'alert'),
            'src_ip': data.get('src_ip'),
            'dest_ip': data.get('dest_ip'),
            'src_port': data.get('src_port'),
            'dest_port': data.get('dest_port'),
            'proto': data.get('proto'),
            'alert': {
                'signature': alert.get('signature'),
                'signature_id': alert.get('signature_id'),
                'severity': alert.get('severity'),
                'category': alert.get('category'),
                'action': alert.get('action')
            },
            'flow_id': data.get('flow_id'),
            'in_iface': data.get('in_iface')
        }
        
        return {k: v for k, v in doc.items() if v is not None}
    
    @staticmethod
    def transform_threat_session(data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform threat analysis to ES document"""
        llm = data.get('llm_analysis', {})
        action = data.get('automated_action', {})
        
        doc = {
            '@timestamp': datetime.utcnow().isoformat(),
            'session_id': data.get('session_id'),
            'src_ip': data.get('src_ip'),
            'dst_ip': data.get('dst_ip'),
            'duration_seconds': data.get('duration'),
            'packet_count': data.get('packet_count'),
            'byte_count': data.get('byte_count'),
            'unique_ports': data.get('unique_ports'),
            'protocols': data.get('protocols', []),
            'anomaly_score': data.get('anomaly_score'),
            'is_anomaly': data.get('is_anomaly', False),
            'threat_classification': data.get('classification'),
            'threat_confidence': data.get('confidence'),
            'llm_analysis': {
                'threat_level': llm.get('threat_level'),
                'attack_type': llm.get('attack_type'),
                'explanation': llm.get('explanation'),
                'recommendation': llm.get('recommendation')
            } if llm else None,
            'automated_action': {
                'type': action.get('type'),
                'target': action.get('target'),
                'status': action.get('status'),
                'applied_at': action.get('applied_at')
            } if action else None
        }
        
        return {k: v for k, v in doc.items() if v is not None}
    
    def transform(self, topic: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Route to appropriate transformer based on topic"""
        if topic == 'firewall-logs':
            return self.transform_firewall_log(data)
        elif topic == 'suricata-alerts':
            return self.transform_suricata_alert(data)
        elif topic in ['threat-intel', 'ai-analysis']:
            return self.transform_threat_session(data)
        else:
            # Generic passthrough with timestamp
            data['@timestamp'] = data.get('@timestamp') or datetime.utcnow().isoformat()
            return data

# ===========================================
# Main Connector
# ===========================================
class KafkaElasticsearchConnector:
    """Streams data from Kafka to Elasticsearch"""
    
    def __init__(self):
        self.running = True
        self.consumer = None
        self.es = None
        self.transformer = DocumentTransformer()
        self.buffer = []
        self.last_flush = datetime.now()
        
        # Statistics
        self.stats = {
            'messages_consumed': 0,
            'documents_indexed': 0,
            'errors': 0
        }
    
    def connect(self):
        """Initialize connections"""
        logger.info("Connecting to Kafka...")
        self.consumer = KafkaConsumer(
            *TOPIC_INDEX_MAP.keys(),
            bootstrap_servers=KAFKA_BOOTSTRAP,
            group_id='kafka-es-connector',
            auto_offset_reset='latest',
            enable_auto_commit=True,
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )
        logger.info(f"Subscribed to topics: {list(TOPIC_INDEX_MAP.keys())}")
        
        logger.info("Connecting to Elasticsearch...")
        self.es = Elasticsearch([ELASTICSEARCH_URL])
        
        if not self.es.ping():
            raise ConnectionError("Cannot connect to Elasticsearch")
        
        logger.info("Elasticsearch connected")
    
    def flush_buffer(self):
        """Bulk index buffered documents"""
        if not self.buffer:
            return
        
        try:
            success, errors = helpers.bulk(
                self.es,
                self.buffer,
                raise_on_error=False
            )
            
            self.stats['documents_indexed'] += success
            if errors:
                self.stats['errors'] += len(errors)
                logger.warning(f"Bulk indexing had {len(errors)} errors")
            
            logger.info(f"Indexed {success} documents (Total: {self.stats['documents_indexed']})")
            
        except Exception as e:
            logger.error(f"Bulk indexing failed: {e}")
            self.stats['errors'] += len(self.buffer)
        
        self.buffer = []
        self.last_flush = datetime.now()
    
    def process_message(self, message):
        """Process a single Kafka message"""
        topic = message.topic
        
        try:
            data = message.value
            doc = self.transformer.transform(topic, data)
            
            if doc:
                index_name = TOPIC_INDEX_MAP.get(topic, 'misc-logs')
                
                self.buffer.append({
                    '_index': index_name,
                    '_source': doc
                })
                
                self.stats['messages_consumed'] += 1
                
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            self.stats['errors'] += 1
    
    def run(self):
        """Main processing loop"""
        logger.info("Starting Kafka to Elasticsearch connector...")
        
        try:
            self.connect()
        except Exception as e:
            logger.error(f"Connection failed: {e}")
            return
        
        logger.info("Connector running. Press Ctrl+C to stop.")
        
        while self.running:
            try:
                # Poll for messages with timeout
                messages = self.consumer.poll(timeout_ms=1000)
                
                for topic_partition, records in messages.items():
                    for record in records:
                        self.process_message(record)
                
                # Flush if buffer is full or timeout reached
                elapsed = (datetime.now() - self.last_flush).seconds
                if len(self.buffer) >= BATCH_SIZE or (self.buffer and elapsed >= FLUSH_INTERVAL):
                    self.flush_buffer()
                    
            except Exception as e:
                logger.error(f"Processing error: {e}")
        
        # Final flush
        self.flush_buffer()
        
        logger.info(f"Connector stopped. Stats: {self.stats}")
    
    def stop(self):
        """Stop the connector gracefully"""
        logger.info("Stopping connector...")
        self.running = False

# ===========================================
# Entry Point
# ===========================================
def main():
    connector = KafkaElasticsearchConnector()
    
    def signal_handler(sig, frame):
        connector.stop()
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    connector.run()

if __name__ == '__main__':
    main()
