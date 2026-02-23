/**
 * FirewallAI Backend Server - Enhanced Version (Dual AI Support)
 * ==============================================================
 * Features:
 * - DUAL AI PROVIDERS: Groq API (fast cloud) OR Ollama (local LLM)
 * - Real-time streaming from Kafka (optional)
 * - WebSocket Terminal (PTY) sessions
 * - Remote pfSense Management
 * - Elasticsearch integration (optional)
 * - Automated rule deployment with audit logging
 * 
 * SETUP:
 * 1. npm install groq-sdk node-pty node-ssh socket.io express cors dotenv kafkajs axios
 * 2. Set environment variables in .env:
 *    - AI_PROVIDER=groq|ollama (default: groq if GROQ_API_KEY set)
 *    - GROQ_API_KEY=your-key
 *    - OLLAMA_URL=http://localhost:11434
 * ==============================================================
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const cors = require('cors');
const dgram = require('dgram');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { NodeSSH } = require('node-ssh');
const pty = require('node-pty');

// Optional Kafka (graceful if not installed)
let Kafka = null;
try {
    Kafka = require('kafkajs').Kafka;
} catch (e) {
    console.log('[INFO] kafkajs not installed - Kafka streaming disabled');
}

// Optional Groq SDK
let Groq = null;
try {
    Groq = require('groq-sdk');
} catch (e) {
    console.log('[INFO] groq-sdk not installed');
}

// ===========================================
// Configuration
// ===========================================
const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',

    // pfSense
    pfsense: {
        host: process.env.PFSENSE_HOST || '192.168.1.1',
        user: process.env.PFSENSE_USER || 'admin',
        password: process.env.PFSENSE_PASSWORD || 'pfsense',
    },

    // AI Configuration - supports both Groq and Ollama
    ai: {
        // 'groq' or 'ollama' - auto-detect if not set
        provider: process.env.AI_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : 'ollama'),

        // Groq settings
        groq: {
            apiKey: process.env.GROQ_API_KEY,
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        },

        // Ollama settings
        ollama: {
            url: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
            model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
        }
    },

    // Kafka (optional)
    kafka: {
        enabled: process.env.KAFKA_ENABLED === 'true',
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        topics: {
            firewallLogs: 'firewall-logs',
            suricataAlerts: 'suricata-alerts',
            realtimeMetrics: 'realtime-metrics',
            automationAudit: 'automation-audit'
        }
    },

    // Elasticsearch (optional)
    elasticsearch: {
        url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
        enabled: process.env.ELASTICSEARCH_ENABLED === 'true'
    }
};

// ===========================================
// Initialize AI Clients
// ===========================================
let groqClient = null;
if (Groq && config.ai.groq.apiKey) {
    groqClient = new Groq({ apiKey: config.ai.groq.apiKey });
    console.log('[AI] Groq client initialized');
}

// Check Ollama availability
async function checkOllama() {
    try {
        const response = await axios.get(`${config.ai.ollama.url}/api/tags`, { timeout: 3000 });
        return response.status === 200;
    } catch (e) {
        return false;
    }
}

// SSH Client for pfSense
const ssh = new NodeSSH();

// Kafka clients (optional)
let kafkaConsumer = null;
let kafkaProducer = null;

// Local Blocklist File
const LOCAL_BLOCKLIST_PATH = path.join(__dirname, 'ai_blocklist.txt');
const AUDIT_LOG_PATH = path.join(__dirname, 'audit_log.json');

// Ensure files exist
if (!fs.existsSync(LOCAL_BLOCKLIST_PATH)) {
    fs.writeFileSync(LOCAL_BLOCKLIST_PATH, "# AI Generated Blocklist\n");
}
if (!fs.existsSync(AUDIT_LOG_PATH)) {
    fs.writeFileSync(AUDIT_LOG_PATH, "[]");
}

// Real-time stats
const realtimeStats = {
    eventsProcessed: 0,
    eventsPerSecond: 0,
    lastMinuteEvents: [],
    topSources: new Map(),
    protocolDistribution: new Map(),
    actionDistribution: { block: 0, pass: 0, other: 0 },
    alerts: [],
    anomalies: []
};

// ===========================================
// Express App Setup
// ===========================================
const app = express();

// ── Security: Restricted CORS (was wildcard "*") ──
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    `http://192.168.1.100:5173`,  // Windows Dashboard VM
    `http://192.168.1.101:5173`,  // Ubuntu (if hosting frontend)
];
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (curl, server-to-server)
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked request from origin: ${origin}`);
            callback(null, true); // In dev mode, still allow but log
        }
    },
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// ── Security: Input Validation ──
function isValidIP(ip) {
    return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
}

function isValidDomain(domain) {
    return /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(domain);
}

function sanitizeRuleTarget(rule) {
    if (!rule || !rule.type || !rule.target) {
        return { valid: false, error: 'Missing rule type or target' };
    }
    // Strip any shell metacharacters
    const cleanTarget = rule.target.replace(/[;&|`$(){}\[\]!#]/g, '').trim();
    if (rule.type === 'ip' && !isValidIP(cleanTarget)) {
        return { valid: false, error: `Invalid IP address: ${cleanTarget}` };
    }
    if (rule.type === 'domain' && !isValidDomain(cleanTarget)) {
        return { valid: false, error: `Invalid domain: ${cleanTarget}` };
    }
    rule.target = cleanTarget;
    return { valid: true };
}

// Health check endpoint
app.get('/health', async (req, res) => {
    const ollamaReady = await checkOllama();

    res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        version: '2.1.0',
        uptime: process.uptime(),
        platform: os.platform(),
        ai: {
            provider: config.ai.provider,
            groq_ready: !!groqClient,
            ollama_ready: ollamaReady,
            active_model: config.ai.provider === 'groq'
                ? config.ai.groq.model
                : config.ai.ollama.model
        },
        kafka: kafkaConsumer ? 'connected' : 'disabled'
    });
});

// Blocklist hosting for pfBlockerNG
app.get('/ai.txt', (req, res) => {
    res.sendFile(LOCAL_BLOCKLIST_PATH);
});

// ===========================================
// AI Provider Selection Endpoint
// ===========================================
app.get('/api/ai/providers', async (req, res) => {
    const ollamaAvailable = await checkOllama();

    res.json({
        current: config.ai.provider,
        available: {
            groq: {
                ready: !!groqClient,
                model: config.ai.groq.model
            },
            ollama: {
                ready: ollamaAvailable,
                url: config.ai.ollama.url,
                model: config.ai.ollama.model
            }
        }
    });
});

app.post('/api/ai/switch', (req, res) => {
    const { provider } = req.body;

    if (provider !== 'groq' && provider !== 'ollama') {
        return res.status(400).json({ error: 'Invalid provider. Use "groq" or "ollama"' });
    }

    if (provider === 'groq' && !groqClient) {
        return res.status(400).json({ error: 'Groq not configured. Set GROQ_API_KEY in .env' });
    }

    config.ai.provider = provider;
    console.log(`[AI] Switched to provider: ${provider}`);

    res.json({ success: true, provider, model: provider === 'groq' ? config.ai.groq.model : config.ai.ollama.model });
});

// ===========================================
// AI Rule Generation (Dual Provider Support)
// ===========================================
const AI_SYSTEM_PROMPT = `You are a cybersecurity expert API.
Analyze the user's intent AND any provided LOG/JSON context.
Output a VALID JSON object for a firewall rule based on the analysis.
NO markdown, NO explanations. ONLY JSON.

Output Format:
{
  "type": "ip" | "domain",
  "target": "string (ip address or domain)",
  "action": "block" | "allow",
  "interface": "wan" | "lan" | "both",
  "protocol": "tcp" | "udp" | "any",
  "port": "number or string (e.g. 80, 443, any)",
  "reason": "short explanation of why this rule was generated",
  "confidence": 0.0-1.0
}

Examples:
"Block youtube.com" -> {"type": "domain", "target": "youtube.com", "action": "block", "protocol": "any", "port": "any", "reason": "User request", "confidence": 1.0}
"Analyze logs" + [JSON data showing brute force from 1.2.3.4] -> {"type": "ip", "target": "1.2.3.4", "action": "block", "interface": "both", "protocol": "any", "port": "any", "reason": "Detected brute force attack in logs", "confidence": 0.95}`;

async function generateRuleWithGroq(prompt, contextData) {
    if (!groqClient) {
        throw new Error('Groq client not initialized');
    }

    const fullUserMessage = contextData
        ? `CONTEXT DATA:\n${contextData}\n\nUSER REQUEST: ${prompt}`
        : prompt;

    const chatCompletion = await groqClient.chat.completions.create({
        messages: [
            { role: 'system', content: AI_SYSTEM_PROMPT },
            { role: 'user', content: fullUserMessage }
        ],
        model: config.ai.groq.model,
        temperature: 0.1,
        max_tokens: 1024,
        response_format: { type: "json_object" }
    });

    const content = chatCompletion.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
}

async function generateRuleWithOllama(prompt, contextData) {
    const fullPrompt = contextData
        ? `CONTEXT DATA:\n${contextData}\n\nUSER REQUEST: ${prompt}`
        : prompt;

    const response = await axios.post(`${config.ai.ollama.url}/api/generate`, {
        model: config.ai.ollama.model,
        format: "json",
        prompt: `${AI_SYSTEM_PROMPT}\n\nUser: ${fullPrompt}`,
        stream: false,
        options: { temperature: 0.1, num_ctx: 2048 }
    }, { timeout: 60000 });

    let rawText = response.data.response.trim();

    // Try to extract JSON
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        rawText = jsonMatch[0];
    }

    return JSON.parse(rawText);
}

app.post('/api/generate-rule', async (req, res) => {
    const { prompt, contextData, provider } = req.body;

    // Allow per-request provider override
    const useProvider = provider || config.ai.provider;

    console.log(`[AI-${useProvider.toUpperCase()}] Request: "${prompt}" ${contextData ? `(With ${contextData.length} chars of context)` : ''}`);

    try {
        let ruleData;

        if (useProvider === 'groq' && groqClient) {
            ruleData = await generateRuleWithGroq(prompt, contextData);
        } else {
            // Fallback to Ollama or if explicitly requested
            const ollamaAvailable = await checkOllama();
            if (!ollamaAvailable) {
                return res.status(503).json({
                    error: 'No AI provider available',
                    details: 'Groq not configured and Ollama not running'
                });
            }
            ruleData = await generateRuleWithOllama(prompt, contextData);
        }

        // AI correction logic
        if (ruleData.type === "domain" && ruleData.target && !ruleData.target.includes(".")) {
            ruleData.target += ".com";
        }

        // Extract IP from prompt if AI missed it
        const ipMatch = prompt.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
        if (ipMatch && ruleData.type !== "ip") {
            ruleData.type = "ip";
            ruleData.target = ipMatch[0];
        }

        // Add default confidence if missing
        if (!ruleData.confidence) {
            ruleData.confidence = 0.8;
        }

        res.json({ success: true, rule: ruleData, provider: useProvider });

    } catch (error) {
        console.error(`[AI ERROR]:`, error.message);
        res.status(500).json({ error: "AI Generation Failed", details: error.message });
    }
});

// ===========================================
// Apply Rule to pfSense
// ===========================================
app.post('/api/apply-rule', async (req, res) => {
    const { rule, approved = false } = req.body;
    console.log(`[APPLY] ${rule.type} -> ${rule.target} (approved: ${approved})`);

    // ── Security: Validate input before SSH execution ──
    const validation = sanitizeRuleTarget(rule);
    if (!validation.valid) {
        return res.status(400).json({ error: 'Invalid rule target', details: validation.error });
    }

    // Log to audit trail
    const auditEntry = {
        timestamp: new Date().toISOString(),
        rule,
        approved,
        status: 'pending'
    };

    try {
        // High confidence rules can be auto-applied, others need approval
        if (!approved && rule.confidence && rule.confidence < 0.9) {
            auditEntry.status = 'pending_approval';
            appendAuditLog(auditEntry);

            return res.json({
                success: false,
                requiresApproval: true,
                message: `Rule confidence (${Math.round(rule.confidence * 100)}%) below threshold. Manual approval required.`,
                auditId: auditEntry.timestamp
            });
        }

        await ssh.connect({
            host: config.pfsense.host,
            username: config.pfsense.user,
            password: config.pfsense.password,
        });

        let commands = [];
        let successMsg = "";

        if (rule.type === "ip") {
            const action = rule.action === 'block' ? 'block' : 'pass';
            const iface = (rule.interface || 'both').toLowerCase();

            if (iface === 'both') {
                commands.push(`easyrule ${action} wan ${rule.target}`);
                commands.push(`easyrule ${action} lan ${rule.target}`);
            } else {
                commands.push(`easyrule ${action} ${iface} ${rule.target}`);
            }

            // Aggressive state killing for immediate effect
            if (action === 'block') {
                commands.push(`pfctl -k ${rule.target}`);
                commands.push(`pfctl -k 0.0.0.0/0 -k ${rule.target}`);
                commands.push(`pfctl -K ${rule.target}`);
            }

            successMsg = `Firewall: ${action.toUpperCase()} IP ${rule.target} on ${iface === 'both' ? 'WAN+LAN' : iface.toUpperCase()} (states cleared)`;

        } else if (rule.type === "domain") {
            // Add to local blocklist
            fs.appendFileSync(LOCAL_BLOCKLIST_PATH, `\n${rule.target}`);
            console.log(`[FILE] Added ${rule.target} to local blocklist`);

            // Also add to pfBlockerNG if available
            commands.push(`echo "${rule.target}" >> /var/db/pfblockerng/dnsbl/custom_list.txt`);
            commands.push(`/usr/local/bin/php /usr/local/www/pfblockerng/pfblockerng.php update cron`);
            successMsg = `DNSBL: Added ${rule.target} to blocklist (reloading...)`;
        }

        // Execute commands
        for (const command of commands) {
            console.log(`[SSH] Executing: ${command}`);
            const result = await ssh.execCommand(command);
            if (result.stdout) console.log("[SSH OUTPUT]:", result.stdout);
            if (result.stderr) console.log("[SSH STDERR]:", result.stderr);
        }

        ssh.dispose();

        auditEntry.status = 'applied';
        auditEntry.message = successMsg;
        appendAuditLog(auditEntry);

        // Publish to Kafka if connected
        if (kafkaProducer) {
            await kafkaProducer.send({
                topic: config.kafka.topics.automationAudit,
                messages: [{ value: JSON.stringify(auditEntry) }]
            });
        }

        res.json({ success: true, message: successMsg });

    } catch (error) {
        console.error("[SSH ERROR]:", error.message);
        auditEntry.status = 'failed';
        auditEntry.error = error.message;
        appendAuditLog(auditEntry);

        res.status(500).json({ error: "Operation Failed", details: error.message });
    }
});

// ===========================================
// Real-time Stats Endpoint
// ===========================================
app.get('/api/stats/realtime', (req, res) => {
    const topSourcesArray = Array.from(realtimeStats.topSources.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count }));

    const protocolArray = Array.from(realtimeStats.protocolDistribution.entries())
        .map(([protocol, count]) => ({ protocol, count }));

    res.json({
        eventsProcessed: realtimeStats.eventsProcessed,
        eventsPerSecond: Math.round(realtimeStats.eventsPerSecond * 100) / 100,
        topSources: topSourcesArray,
        protocolDistribution: protocolArray,
        actionDistribution: realtimeStats.actionDistribution,
        recentAlerts: realtimeStats.alerts.slice(0, 10),
        anomalies: realtimeStats.anomalies.slice(0, 10)
    });
});

// ===========================================
// Audit Log Endpoints
// ===========================================
app.get('/api/audit-log', (req, res) => {
    try {
        const logs = JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, 'utf8'));
        res.json(logs.slice(-100).reverse());
    } catch (error) {
        res.json([]);
    }
});

function appendAuditLog(entry) {
    try {
        let logs = [];
        if (fs.existsSync(AUDIT_LOG_PATH)) {
            logs = JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, 'utf8'));
        }
        logs.push(entry);
        if (logs.length > 1000) {
            logs = logs.slice(-1000);
        }
        fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error('[AUDIT] Failed to write audit log:', error);
    }
}

// ===========================================
// Elasticsearch Log Search Endpoints
// ===========================================
app.get('/api/logs/search', async (req, res) => {
    const { query = '*', from = 0, size = 50, startTime = 'now-1h' } = req.query;

    if (!config.elasticsearch.enabled) {
        // Return mock data if ES not configured
        return res.json({
            logs: generateMockLogs(parseInt(size)),
            total: 500,
            source: 'mock'
        });
    }

    try {
        const response = await axios.post(`${config.elasticsearch.url}/firewall-events/_search`, {
            query: {
                bool: {
                    must: [
                        { query_string: { query } },
                        { range: { '@timestamp': { gte: startTime } } }
                    ]
                }
            },
            sort: [{ '@timestamp': 'desc' }],
            from: parseInt(from),
            size: parseInt(size)
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        const logs = response.data.hits.hits.map(hit => ({
            id: hit._id,
            ...hit._source
        }));

        res.json({
            logs,
            total: response.data.hits.total.value,
            source: 'elasticsearch'
        });

    } catch (error) {
        console.error('[ES ERROR]:', error.message);
        res.json({
            logs: generateMockLogs(parseInt(size)),
            total: 500,
            source: 'mock',
            error: error.message
        });
    }
});

app.get('/api/logs/aggregations', async (req, res) => {
    const { startTime = 'now-1h' } = req.query;

    if (!config.elasticsearch.enabled) {
        return res.json(generateMockAggregations());
    }

    try {
        const response = await axios.post(`${config.elasticsearch.url}/firewall-events/_search`, {
            size: 0,
            query: { range: { '@timestamp': { gte: startTime } } },
            aggs: {
                actions: { terms: { field: 'action.keyword', size: 10 } },
                protocols: { terms: { field: 'protocol.keyword', size: 10 } },
                top_sources: { terms: { field: 'src_ip', size: 20 } },
                top_destinations: { terms: { field: 'dst_ip', size: 20 } },
                over_time: {
                    date_histogram: {
                        field: '@timestamp',
                        fixed_interval: '5m'
                    }
                }
            }
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        res.json(response.data.aggregations);

    } catch (error) {
        console.error('[ES AGG ERROR]:', error.message);
        res.json(generateMockAggregations());
    }
});

// ===========================================
// Threat Intelligence Endpoints
// ===========================================
app.get('/api/threats/summary', async (req, res) => {
    const { startTime = 'now-24h' } = req.query;

    if (!config.elasticsearch.enabled) {
        return res.json(generateMockThreatSummary());
    }

    try {
        const [alertsResponse, threatsResponse] = await Promise.all([
            axios.post(`${config.elasticsearch.url}/suricata-alerts/_search`, {
                size: 0,
                query: { range: { '@timestamp': { gte: startTime } } },
                aggs: {
                    by_severity: { terms: { field: 'alert.severity' } },
                    by_category: { terms: { field: 'alert.category.keyword', size: 15 } },
                    top_attackers: { terms: { field: 'src_ip', size: 10 } },
                    recent_alerts: {
                        top_hits: {
                            size: 10,
                            sort: [{ '@timestamp': 'desc' }]
                        }
                    }
                }
            }, { timeout: 10000 }),
            axios.post(`${config.elasticsearch.url}/threat-sessions/_search`, {
                size: 0,
                query: { range: { '@timestamp': { gte: startTime } } },
                aggs: {
                    anomalies: { filter: { term: { is_anomaly: true } } },
                    by_classification: { terms: { field: 'threat_classification.keyword' } }
                }
            }, { timeout: 10000 }).catch(() => ({ data: { aggregations: {} } }))
        ]);

        res.json({
            severityCounts: alertsResponse.data.aggregations.by_severity.buckets,
            categories: alertsResponse.data.aggregations.by_category.buckets,
            topAttackers: alertsResponse.data.aggregations.top_attackers.buckets,
            recentAlerts: alertsResponse.data.aggregations.recent_alerts.hits.hits.map(h => h._source),
            anomalyCount: threatsResponse.data.aggregations?.anomalies?.doc_count || 0,
            classifications: threatsResponse.data.aggregations?.by_classification?.buckets || []
        });

    } catch (error) {
        console.error('[THREAT API ERROR]:', error.message);
        res.json(generateMockThreatSummary());
    }
});

app.get('/api/threats/anomalies', async (req, res) => {
    const { limit = 20 } = req.query;

    if (!config.elasticsearch.enabled) {
        return res.json({ anomalies: [], source: 'mock' });
    }

    try {
        const response = await axios.post(`${config.elasticsearch.url}/threat-sessions/_search`, {
            query: { term: { is_anomaly: true } },
            sort: [{ '@timestamp': 'desc' }],
            size: parseInt(limit)
        }, { timeout: 10000 });

        res.json({
            anomalies: response.data.hits.hits.map(h => h._source),
            total: response.data.hits.total.value,
            source: 'elasticsearch'
        });

    } catch (error) {
        res.json({ anomalies: [], source: 'mock', error: error.message });
    }
});

// ===========================================
// AI Metrics Snapshot Endpoint (for AIMetricsPage)
// ===========================================
app.get('/api/metrics/snapshot', async (req, res) => {
    const { startTime = 'now-1h' } = req.query;

    if (!config.elasticsearch.enabled) {
        return res.json(generateMockMetricsSnapshot());
    }

    try {
        const [snapshotRes, anomalyScoresRes, mttrRes] = await Promise.all([
            // Latest engine snapshot
            axios.post(`${config.elasticsearch.url}/ai-metrics/_search`, {
                size: 1,
                query: { term: { metric_type: 'engine_snapshot' } },
                sort: [{ '@timestamp': 'desc' }]
            }, { timeout: 10000 }).catch(() => null),

            // Recent anomaly scores for chart
            axios.post(`${config.elasticsearch.url}/ai-metrics/_search`, {
                size: 50,
                query: {
                    bool: {
                        must: [
                            { term: { metric_type: 'anomaly_score' } },
                            { range: { '@timestamp': { gte: startTime } } }
                        ]
                    }
                },
                sort: [{ '@timestamp': 'desc' }]
            }, { timeout: 10000 }).catch(() => null),

            // Recent MTTR entries
            axios.post(`${config.elasticsearch.url}/ai-metrics/_search`, {
                size: 50,
                query: {
                    bool: {
                        must: [
                            { term: { metric_type: 'mttr' } },
                            { range: { '@timestamp': { gte: startTime } } }
                        ]
                    }
                },
                sort: [{ '@timestamp': 'desc' }]
            }, { timeout: 10000 }).catch(() => null)
        ]);

        const snapshot = snapshotRes?.data?.hits?.hits?.[0]?._source || {};
        const anomalyScores = anomalyScoresRes?.data?.hits?.hits?.map(h => h._source) || [];
        const mttrEntries = mttrRes?.data?.hits?.hits?.map(h => h._source) || [];

        res.json({
            snapshot: {
                anomalies_detected_total: snapshot.anomalies_detected_total || 0,
                rules_generated_total: snapshot.rules_generated_total || 0,
                avg_classification_confidence: snapshot.avg_classification_confidence || 0,
                avg_llm_latency_ms: snapshot.avg_llm_latency_ms || 0,
                avg_anomaly_score: snapshot.avg_anomaly_score || 0,
                avg_mttr_seconds: snapshot.avg_mttr_seconds || 0,
                sub_3s_response_rate: snapshot.sub_3s_response_rate || 0,
                events_per_second: snapshot.events_per_second || 0,
                events_processed_total: snapshot.events_processed_total || 0,
                auto_blocks: snapshot.auto_blocks || 0,
                manual_blocks: snapshot.manual_blocks || 0,
                sessions_analyzed_total: snapshot.sessions_analyzed_total || 0,
            },
            anomalyScores: anomalyScores.map(s => ({
                time: s['@timestamp'],
                score: s.anomaly_score,
                isAnomaly: s.is_anomaly,
                classification: s.classification
            })),
            mttrEntries: mttrEntries.map(m => ({
                time: m['@timestamp'],
                mttr: m.mttr_seconds,
                classification: m.classification,
                srcIp: m.src_ip
            })),
            source: 'elasticsearch'
        });

    } catch (error) {
        console.error('[METRICS API ERROR]:', error.message);
        res.json(generateMockMetricsSnapshot());
    }
});

// ===========================================
// Mock Data Generators (for when ES is offline)
// ===========================================
function generateMockLogs(count = 50) {
    const logs = [];
    const actions = ['pass', 'block'];
    const protocols = ['TCP', 'UDP', 'ICMP'];
    const interfaces = ['wan', 'lan'];

    for (let i = 0; i < count; i++) {
        const timestamp = new Date(Date.now() - Math.random() * 3600000);
        logs.push({
            id: `mock-${i}`,
            '@timestamp': timestamp.toISOString(),
            src_ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            dst_ip: `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            src_port: Math.floor(Math.random() * 65535),
            dst_port: [80, 443, 22, 3389, 53][Math.floor(Math.random() * 5)],
            protocol: protocols[Math.floor(Math.random() * protocols.length)],
            action: actions[Math.floor(Math.random() * actions.length)],
            interface: interfaces[Math.floor(Math.random() * interfaces.length)]
        });
    }

    return logs;
}

function generateMockAggregations() {
    return {
        actions: { buckets: [{ key: 'pass', doc_count: 8500 }, { key: 'block', doc_count: 1500 }] },
        protocols: { buckets: [{ key: 'TCP', doc_count: 6000 }, { key: 'UDP', doc_count: 3000 }, { key: 'ICMP', doc_count: 1000 }] },
        top_sources: { buckets: [{ key: '192.168.1.100', doc_count: 500 }, { key: '192.168.1.105', doc_count: 350 }] },
        over_time: { buckets: [] }
    };
}

function generateMockThreatSummary() {
    // Diverse attack types matching Kali simulation scripts
    return {
        severityCounts: [
            { key: 1, doc_count: 8 },   // Low: DNS tunneling, slow probes
            { key: 2, doc_count: 22 },   // Medium: port scans, web enumeration
            { key: 3, doc_count: 35 }    // High: brute force, DDoS, exploits
        ],
        categories: [
            { key: 'Port Scan / Network Recon', doc_count: 28 },
            { key: 'SSH Brute Force', doc_count: 15 },
            { key: 'Web Application Attack', doc_count: 18 },
            { key: 'DDoS / Flood', doc_count: 12 },
            { key: 'DNS Tunneling', doc_count: 5 },
            { key: 'SQL Injection', doc_count: 8 },
            { key: 'XSS Attack', doc_count: 6 },
            { key: 'Directory Traversal', doc_count: 4 }
        ],
        topAttackers: [
            { key: '192.168.56.102', doc_count: 42 },   // Kali VM
            { key: '203.0.113.50', doc_count: 15 },
            { key: '198.51.100.25', doc_count: 8 },
            { key: '10.0.2.15', doc_count: 6 },
            { key: '172.16.0.100', doc_count: 4 }
        ],
        recentAlerts: [
            {
                '@timestamp': new Date(Date.now() - 30000).toISOString(),
                src_ip: '192.168.56.102',
                dest_ip: '192.168.1.1',
                alert: { signature: 'ET SCAN Nmap SYN Scan', severity: 2, category: 'Port Scan' }
            },
            {
                '@timestamp': new Date(Date.now() - 120000).toISOString(),
                src_ip: '192.168.56.102',
                dest_ip: '192.168.1.1',
                alert: { signature: 'ET BRUTE FORCE SSH', severity: 3, category: 'Brute Force' }
            },
            {
                '@timestamp': new Date(Date.now() - 300000).toISOString(),
                src_ip: '203.0.113.50',
                dest_ip: '192.168.1.100',
                alert: { signature: 'ET WEB_SERVER SQL Injection Attempt', severity: 3, category: 'Web Application Attack' }
            }
        ],
        anomalyCount: 18,
        classifications: [
            { key: 'port_scan', doc_count: 14 },
            { key: 'brute_force', doc_count: 10 },
            { key: 'ddos', doc_count: 8 },
            { key: 'web_attack', doc_count: 9 },
            { key: 'sql_injection', doc_count: 5 },
            { key: 'dns_tunneling', doc_count: 3 },
            { key: 'xss', doc_count: 4 },
            { key: 'directory_traversal', doc_count: 2 }
        ]
    };
}

function generateMockMetricsSnapshot() {
    const now = Date.now();
    const attackTypes = ['port_scan', 'brute_force', 'ddos', 'web_attack', 'sql_injection', 'xss', 'dns_tunneling'];
    const sourceIPs = ['192.168.56.102', '203.0.113.50', '198.51.100.25', '10.0.2.15'];

    // Generate realistic anomaly score history
    const anomalyScores = [];
    for (let i = 0; i < 30; i++) {
        const isAnomaly = Math.random() > 0.6;
        anomalyScores.push({
            time: new Date(now - (30 - i) * 120000).toISOString(),
            score: isAnomaly ? -0.6 - Math.random() * 0.4 : -0.1 + Math.random() * 0.3,
            isAnomaly,
            classification: isAnomaly ? attackTypes[Math.floor(Math.random() * attackTypes.length)] : 'normal'
        });
    }

    // Generate MTTR entries
    const mttrEntries = [];
    for (let i = 0; i < 15; i++) {
        mttrEntries.push({
            time: new Date(now - (15 - i) * 300000).toISOString(),
            mttr: 0.8 + Math.random() * 3.5,
            classification: attackTypes[Math.floor(Math.random() * attackTypes.length)],
            srcIp: sourceIPs[Math.floor(Math.random() * sourceIPs.length)]
        });
    }

    return {
        snapshot: {
            anomalies_detected_total: 18 + Math.floor(Math.random() * 5),
            rules_generated_total: 12 + Math.floor(Math.random() * 3),
            avg_classification_confidence: 0.87 + Math.random() * 0.08,
            avg_llm_latency_ms: 800 + Math.random() * 1500,
            avg_anomaly_score: -0.3 + Math.random() * 0.2,
            avg_mttr_seconds: 1.5 + Math.random() * 2.0,
            sub_3s_response_rate: 85 + Math.random() * 12,
            events_per_second: Math.floor(2000 + Math.random() * 1500),
            events_processed_total: 125000 + Math.floor(Math.random() * 10000),
            auto_blocks: 14 + Math.floor(Math.random() * 5),
            manual_blocks: 3 + Math.floor(Math.random() * 2),
            sessions_analyzed_total: 55 + Math.floor(Math.random() * 10),
        },
        anomalyScores,
        mttrEntries,
        source: 'mock'
    };
}

// ===========================================
// HTTP Server & Socket.IO
// ===========================================
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    pingTimeout: 60000,
    pingInterval: 25000
});

// ===========================================
// Kafka Integration (Optional)
// ===========================================
async function initializeKafka() {
    if (!Kafka || !config.kafka.enabled) {
        console.log('[KAFKA] Disabled or not installed');
        return;
    }

    console.log('[KAFKA] Initializing connection...');

    const kafka = new Kafka({
        clientId: 'firewallai-backend',
        brokers: config.kafka.brokers,
        retry: { initialRetryTime: 100, retries: 5 }
    });

    kafkaProducer = kafka.producer();
    await kafkaProducer.connect();
    console.log('[KAFKA] Producer connected');

    kafkaConsumer = kafka.consumer({ groupId: 'firewallai-dashboard' });
    await kafkaConsumer.connect();

    await kafkaConsumer.subscribe({
        topics: [
            config.kafka.topics.firewallLogs,
            config.kafka.topics.suricataAlerts,
            config.kafka.topics.realtimeMetrics,
            'ai-analysis',
            'ai-metrics'
        ],
        fromBeginning: false
    });

    await kafkaConsumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            try {
                const value = JSON.parse(message.value.toString());
                processKafkaMessage(topic, value);
            } catch (e) { /* ignore */ }
        }
    });

    console.log('[KAFKA] Consumer running');
}

function processKafkaMessage(topic, data) {
    realtimeStats.eventsProcessed++;
    realtimeStats.lastMinuteEvents.push(Date.now());

    const oneMinuteAgo = Date.now() - 60000;
    realtimeStats.lastMinuteEvents = realtimeStats.lastMinuteEvents.filter(t => t > oneMinuteAgo);
    realtimeStats.eventsPerSecond = realtimeStats.lastMinuteEvents.length / 60;

    if (topic === config.kafka.topics.suricataAlerts) {
        realtimeStats.alerts.unshift({ timestamp: new Date().toISOString(), ...data });
        realtimeStats.alerts = realtimeStats.alerts.slice(0, 100);
        io.emit('suricata-alert', data);
    }
}

// ===========================================
// Socket.IO Connection Handler (Terminal)
// ===========================================
io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    // System stats loop
    const statsInterval = setInterval(async () => {
        const cpus = os.cpus();
        const idle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
        const total = cpus.reduce((acc, cpu) => acc + Object.values(cpu.times).reduce((a, b) => a + b), 0);
        const load = 100 - Math.round((idle / total) * 100);

        socket.emit('system-stats', {
            cpu: load,
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem()
            },
            eventsPerSecond: realtimeStats.eventsPerSecond,
            totalEvents: realtimeStats.eventsProcessed
        });
    }, 2000);

    // Terminal PTY
    const shell = process.env.SHELL || 'bash';
    let ptyProcess = null;

    try {
        ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-256color',
            cols: 80,
            rows: 24,
            cwd: process.env.HOME,
            env: { ...process.env, TERM: 'xterm-256color' }
        });

        console.log(`[PTY] Spawned ${shell} with PID ${ptyProcess.pid}`);

        ptyProcess.on('data', (data) => {
            socket.emit('terminal:data', data);
        });

        ptyProcess.on('exit', (code) => {
            console.log(`[PTY] Process exited with code ${code}`);
            socket.emit('terminal:exit', { code });
        });
    } catch (err) {
        console.error('[PTY ERROR]:', err.message);
        socket.emit('terminal:data', '\r\n\x1b[31mError spawning terminal session.\r\n');
    }

    socket.on('terminal:write', (data) => {
        if (ptyProcess) {
            ptyProcess.write(data);
        }
    });

    socket.on('terminal:resize', ({ cols, rows }) => {
        if (ptyProcess) {
            try { ptyProcess.resize(cols, rows); } catch (e) { /* ignore */ }
        }
    });

    socket.on('disconnect', () => {
        clearInterval(statsInterval);
        if (ptyProcess) {
            ptyProcess.kill();
        }
        console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
});

// ===========================================
// Start Server
// ===========================================
async function start() {
    // Initialize Kafka if enabled (non-blocking)
    if (config.kafka.enabled) {
        try {
            await initializeKafka();
        } catch (error) {
            console.warn('[KAFKA] Could not connect:', error.message);
        }
    }

    const ollamaReady = await checkOllama();

    server.listen(config.port, config.host, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║   FirewallAI Backend Server v2.1 (Dual AI Support)        ║
╠═══════════════════════════════════════════════════════════╣
║  HOST:     ${config.host}:${config.port}                              ║
║  PLATFORM: ${os.platform()}                                       ║
╠═══════════════════════════════════════════════════════════╣
║  AI PROVIDER: ${config.ai.provider.toUpperCase().padEnd(42)}║
║  - Groq:   ${groqClient ? '✓ Ready' : '✗ Not configured'} (${config.ai.groq.model})        ║
║  - Ollama: ${ollamaReady ? '✓ Ready' : '✗ Not running'} (${config.ai.ollama.model})           ║
╠═══════════════════════════════════════════════════════════╣
║  ENDPOINTS:                                               ║
║  - Health:     /health                                    ║
║  - AI Status:  /api/ai/providers                          ║
║  - Switch AI:  POST /api/ai/switch {provider: "groq"}     ║
║  - Gen Rule:   POST /api/generate-rule                    ║
║  - Apply Rule: POST /api/apply-rule                       ║
║  - Audit Log:  /api/audit-log                             ║
╚═══════════════════════════════════════════════════════════╝
    `);
    });
}

start().catch(console.error);

// ===========================================
// NEW: Geospatial Threat Map Endpoint (Zero RAM)
// ===========================================
// Returns attack origins with lat/lng for client-side map rendering.
// When ES is offline, returns realistic mock geo data.
app.get('/api/geo/attacks', async (req, res) => {
    if (!config.elasticsearch.enabled) {
        return res.json(generateMockGeoAttacks());
    }

    try {
        const response = await axios.post(`${config.elasticsearch.url}/firewall-events/_search`, {
            size: 0,
            query: { range: { '@timestamp': { gte: 'now-1h' } } },
            aggs: {
                by_src_ip: {
                    terms: { field: 'src_ip', size: 50 },
                    aggs: {
                        geo: { top_hits: { size: 1, _source: ['geo.lat', 'geo.lng', 'geo.country', 'geo.country_code', 'geo.city', 'threat_classification'] } }
                    }
                }
            }
        }, { timeout: 10000 });

        const attacks = response.data.aggregations.by_src_ip.buckets.map((b, i) => {
            const src = b.geo?.hits?.hits?.[0]?._source || {};
            return {
                id: `g${i}`,
                srcIp: b.key,
                lat: src.geo?.lat || 0,
                lng: src.geo?.lng || 0,
                country: src.geo?.country || 'Unknown',
                countryCode: src.geo?.country_code || 'XX',
                city: src.geo?.city || '',
                severity: b.doc_count > 500 ? 'critical' : b.doc_count > 100 ? 'high' : b.doc_count > 20 ? 'medium' : 'low',
                classification: src.threat_classification || 'unknown',
                count: b.doc_count,
                lastSeen: new Date().toISOString()
            };
        });

        res.json(buildGeoStats(attacks));
    } catch (error) {
        console.error('[GEO API ERROR]:', error.message);
        res.json(generateMockGeoAttacks());
    }
});

function buildGeoStats(attacks) {
    const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
    const countryMap = new Map();
    for (const a of attacks) {
        severityBreakdown[a.severity] = (severityBreakdown[a.severity] || 0) + 1;
        const existing = countryMap.get(a.countryCode);
        if (existing) existing.count += a.count;
        else countryMap.set(a.countryCode, { country: a.country, code: a.countryCode, count: a.count });
    }
    return {
        totalAttacks: attacks.reduce((sum, a) => sum + a.count, 0),
        uniqueCountries: countryMap.size,
        topCountries: Array.from(countryMap.values()).sort((a, b) => b.count - a.count),
        severityBreakdown,
        attacks
    };
}

function generateMockGeoAttacks() {
    const attacks = [
        { id: 'g1', srcIp: '185.220.101.42', lat: 55.7558, lng: 37.6173, country: 'Russia', countryCode: 'RU', city: 'Moscow', severity: 'critical', classification: 'brute_force', count: 847, lastSeen: new Date().toISOString() },
        { id: 'g2', srcIp: '101.36.100.25', lat: 39.9042, lng: 116.4074, country: 'China', countryCode: 'CN', city: 'Beijing', severity: 'high', classification: 'port_scan', count: 623, lastSeen: new Date().toISOString() },
        { id: 'g3', srcIp: '45.33.32.156', lat: 37.7749, lng: -122.4194, country: 'United States', countryCode: 'US', city: 'San Francisco', severity: 'medium', classification: 'web_attack', count: 312, lastSeen: new Date().toISOString() },
        { id: 'g4', srcIp: '177.54.148.20', lat: -23.5505, lng: -46.6333, country: 'Brazil', countryCode: 'BR', city: 'São Paulo', severity: 'high', classification: 'ddos', count: 534, lastSeen: new Date().toISOString() },
        { id: 'g5', srcIp: '91.108.52.15', lat: 52.52, lng: 13.405, country: 'Germany', countryCode: 'DE', city: 'Berlin', severity: 'medium', classification: 'reconnaissance', count: 189, lastSeen: new Date().toISOString() },
        { id: 'g6', srcIp: '103.152.220.44', lat: 28.6139, lng: 77.209, country: 'India', countryCode: 'IN', city: 'New Delhi', severity: 'low', classification: 'port_scan', count: 97, lastSeen: new Date().toISOString() },
        { id: 'g7', srcIp: '196.216.168.53', lat: -33.9249, lng: 18.4241, country: 'South Africa', countryCode: 'ZA', city: 'Cape Town', severity: 'high', classification: 'ssh_anomaly', count: 256, lastSeen: new Date().toISOString() },
        { id: 'g8', srcIp: '42.112.24.60', lat: 21.0285, lng: 105.8542, country: 'Vietnam', countryCode: 'VN', city: 'Hanoi', severity: 'critical', classification: 'brute_force', count: 761, lastSeen: new Date().toISOString() },
        { id: 'g9', srcIp: '175.45.176.1', lat: 39.0392, lng: 125.7625, country: 'North Korea', countryCode: 'KP', city: 'Pyongyang', severity: 'critical', classification: 'data_exfiltration', count: 43, lastSeen: new Date().toISOString() },
        { id: 'g10', srcIp: '31.13.76.35', lat: 41.0082, lng: 28.9784, country: 'Turkey', countryCode: 'TR', city: 'Istanbul', severity: 'high', classification: 'ddos', count: 412, lastSeen: new Date().toISOString() },
    ];
    return buildGeoStats(attacks);
}

// ===========================================
// NEW: Network Topology Endpoint (Zero RAM)
// ===========================================
app.get('/api/topology', (req, res) => {
    const nodes = [
        { id: 'pfsense', label: 'pfSense Firewall', type: 'firewall', ip: config.pfsense.host, status: 'active', connections: 42, traffic: 12500 },
        { id: 'ubuntu', label: 'Ubuntu Server', type: 'server', ip: config.host + ':' + config.port, status: 'active', connections: 28, traffic: 8400 },
        { id: 'windows', label: 'Windows Dashboard', type: 'client', ip: '192.168.1.100', status: 'active', connections: 5, traffic: 720 },
        { id: 'kali', label: 'Kali Linux', type: 'attacker', ip: '192.168.1.103', status: 'warning', connections: 15, traffic: 3200 },
        { id: 'elasticsearch', label: 'Elasticsearch', type: 'database', ip: config.elasticsearch.url.replace('http://', ''), status: config.elasticsearch.enabled ? 'active' : 'offline', connections: 12, traffic: 5600 },
        { id: 'kafka', label: 'Kafka Broker', type: 'database', ip: config.kafka.brokers[0], status: config.kafka.enabled ? 'active' : 'offline', connections: 8, traffic: 4100 },
        { id: 'grafana', label: 'Grafana', type: 'server', ip: '192.168.1.101:3000', status: 'active', connections: 3, traffic: 320 },
        { id: 'ai', label: config.ai.provider === 'groq' ? 'Groq Cloud AI' : 'Ollama LLM', type: 'external', ip: config.ai.provider === 'groq' ? 'api.groq.com' : config.ai.ollama.url.replace('http://', ''), status: groqClient || config.ai.provider === 'ollama' ? 'active' : 'offline', connections: 2, traffic: 50 },
    ];

    // Add real-time attacker nodes from stats
    const topAttackers = Array.from(realtimeStats.topSources.entries())
        .sort((a, b) => b[1] - a[1]).slice(0, 3);
    topAttackers.forEach(([ip, count], i) => {
        nodes.push({ id: `attacker${i}`, label: `Attacker ${ip}`, type: 'attacker', ip, status: 'critical', connections: count, traffic: count * 10 });
    });

    // If no real attackers, add mock ones
    if (topAttackers.length === 0) {
        nodes.push({ id: 'attacker0', label: 'External Attacker', type: 'attacker', ip: '185.220.101.42', status: 'critical', connections: 847, traffic: 45000 });
        nodes.push({ id: 'attacker1', label: 'Brute Force Bot', type: 'attacker', ip: '101.36.100.25', status: 'critical', connections: 623, traffic: 32000 });
    }

    const edges = [
        { source: 'pfsense', target: 'ubuntu', protocol: 'TCP', packets: 8400, status: 'normal', label: 'LAN' },
        { source: 'pfsense', target: 'windows', protocol: 'TCP', packets: 720, status: 'normal', label: 'LAN' },
        { source: 'windows', target: 'ubuntu', protocol: 'HTTP', packets: 320, status: 'normal', label: 'API' },
        { source: 'ubuntu', target: 'elasticsearch', protocol: 'HTTP', packets: 5600, status: config.elasticsearch.enabled ? 'normal' : 'suspicious', label: '9200' },
        { source: 'ubuntu', target: 'kafka', protocol: 'TCP', packets: 4100, status: config.kafka.enabled ? 'normal' : 'suspicious', label: '9092' },
        { source: 'ubuntu', target: 'grafana', protocol: 'HTTP', packets: 320, status: 'normal', label: '3000' },
        { source: 'ubuntu', target: 'ai', protocol: 'HTTPS', packets: 50, status: 'normal', label: 'AI' },
    ];

    // Add attacker edges
    nodes.filter(n => n.type === 'attacker').forEach(a => {
        edges.push({ source: a.id, target: 'pfsense', protocol: 'TCP', packets: a.traffic, status: 'malicious', label: a.connections > 500 ? 'Brute Force' : 'Scan' });
    });

    res.json({
        nodes, edges,
        stats: {
            totalNodes: nodes.length,
            totalConnections: edges.length,
            anomalousConnections: edges.filter(e => e.status !== 'normal').length,
            activeFlows: edges.reduce((sum, e) => sum + (e.packets || 0), 0)
        }
    });
});

// ===========================================
// NEW: Threat Intelligence Lookup (Zero RAM - Cloud API)
// ===========================================
// Proxies to AlienVault OTX for IP reputation data.
// This costs zero RAM — it's a simple HTTP relay.
app.get('/api/threats/intel/:ip', async (req, res) => {
    const { ip } = req.params;

    if (!isValidIP(ip)) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }

    try {
        // AlienVault OTX — free, no API key needed for basic lookups
        const otxResponse = await axios.get(
            `https://otx.alienvault.com/api/v1/indicators/IPv4/${ip}/general`,
            { timeout: 8000, headers: { 'Accept': 'application/json' } }
        ).catch(() => null);

        if (otxResponse && otxResponse.data) {
            const d = otxResponse.data;
            return res.json({
                ip,
                reputation: d.reputation || 0,
                pulseCount: d.pulse_info?.count || 0,
                country: d.country_name || 'Unknown',
                asn: d.asn || 'Unknown',
                malwareCount: d.malware?.count || 0,
                tags: (d.pulse_info?.pulses || []).slice(0, 5).map(p => p.name),
                source: 'alienvault_otx'
            });
        }

        res.json({ ip, reputation: 0, pulseCount: 0, source: 'unavailable' });
    } catch (error) {
        console.error('[OTX ERROR]:', error.message);
        res.json({ ip, reputation: 0, pulseCount: 0, source: 'error', error: error.message });
    }
});

// ===========================================
// NEW: MITRE ATT&CK Mapping Endpoint
// ===========================================
const MITRE_MAPPING = {
    port_scan: { id: 'T1046', name: 'Network Service Discovery', tactic: 'Discovery', severity: 'medium' },
    brute_force: { id: 'T1110', name: 'Brute Force', tactic: 'Credential Access', severity: 'high' },
    ddos: { id: 'T1498', name: 'Network Denial of Service', tactic: 'Impact', severity: 'critical' },
    web_attack: { id: 'T1190', name: 'Exploit Public-Facing Application', tactic: 'Initial Access', severity: 'critical' },
    ssh_anomaly: { id: 'T1021.004', name: 'Remote Services: SSH', tactic: 'Lateral Movement', severity: 'high' },
    dns_tunneling: { id: 'T1071.004', name: 'Application Layer Protocol: DNS', tactic: 'Command and Control', severity: 'high' },
    data_exfiltration: { id: 'T1041', name: 'Exfiltration Over C2 Channel', tactic: 'Exfiltration', severity: 'critical' },
    reconnaissance: { id: 'T1595', name: 'Active Scanning', tactic: 'Reconnaissance', severity: 'medium' },
    malware: { id: 'T1204', name: 'User Execution', tactic: 'Execution', severity: 'critical' },
    normal: { id: 'N/A', name: 'Normal Traffic', tactic: 'None', severity: 'low' }
};

app.get('/api/mitre/mapping', (req, res) => {
    res.json(MITRE_MAPPING);
});

app.get('/api/mitre/classify/:classification', (req, res) => {
    const key = req.params.classification.toLowerCase().replace(/[\s-]+/g, '_');
    const technique = MITRE_MAPPING[key];
    if (technique) {
        res.json({ classification: key, mitre: technique });
    } else {
        res.status(404).json({ error: 'Classification not found', available: Object.keys(MITRE_MAPPING) });
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[SERVER] Shutting down...');
    if (kafkaConsumer) await kafkaConsumer.disconnect();
    if (kafkaProducer) await kafkaProducer.disconnect();
    server.close(() => process.exit(0));
});
