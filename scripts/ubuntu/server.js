/**
 * FirewallAI Backend Server - Full Featured (Ubuntu)
 * ===================================================
 * Based on Research Paper: Adaptive Network Defense System
 * 
 * Features:
 * - DUAL AI PROVIDERS: Groq API (fast cloud) + Ollama (local fallback)
 * - Real-time statistics streaming via Socket.IO
 * - Audit logging for all rule changes
 * - WebSocket Terminal (PTY) sessions
 * - Remote pfSense Management via SSH
 * - Elasticsearch integration for log search (optional)
 * - Kafka consumer for real-time event processing (optional)
 * 
 * SETUP:
 * 1. npm install
 * 2. Set environment variables in .env
 * 3. node server.js
 * ===================================================
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { NodeSSH } = require('node-ssh');
const pty = require('node-pty');

// Optional Groq SDK
let Groq = null;
try {
    Groq = require('groq-sdk');
} catch (e) {
    console.log('[INFO] groq-sdk not installed - Cloud AI disabled');
}

// Optional Kafka
let Kafka = null;
try {
    Kafka = require('kafkajs').Kafka;
} catch (e) {
    console.log('[INFO] kafkajs not installed - Kafka streaming disabled');
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

        // Groq settings (cloud AI)
        groq: {
            apiKey: process.env.GROQ_API_KEY,
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        },

        // Ollama settings (local AI)
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

// Local Files
const LOCAL_BLOCKLIST_PATH = path.join(__dirname, 'ai_blocklist.txt');
const AUDIT_LOG_PATH = path.join(__dirname, 'audit_log.json');

// Ensure files exist
if (!fs.existsSync(LOCAL_BLOCKLIST_PATH)) {
    fs.writeFileSync(LOCAL_BLOCKLIST_PATH, "# AI Generated Blocklist\n");
}
if (!fs.existsSync(AUDIT_LOG_PATH)) {
    fs.writeFileSync(AUDIT_LOG_PATH, "[]");
}

// ===========================================
// Real-time Statistics Tracking
// ===========================================
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

// Simulate some initial data for demo
function initializeStats() {
    realtimeStats.eventsProcessed = Math.floor(Math.random() * 10000) + 5000;
    realtimeStats.eventsPerSecond = Math.random() * 50 + 10;

    // Sample top sources
    const sampleIPs = ['192.168.1.100', '192.168.1.105', '10.0.0.50', '172.16.0.25', '192.168.1.78'];
    sampleIPs.forEach((ip, i) => {
        realtimeStats.topSources.set(ip, Math.floor(Math.random() * 500) + 100 - i * 50);
    });

    // Sample protocols
    realtimeStats.protocolDistribution.set('TCP', Math.floor(Math.random() * 5000) + 3000);
    realtimeStats.protocolDistribution.set('UDP', Math.floor(Math.random() * 2000) + 1000);
    realtimeStats.protocolDistribution.set('ICMP', Math.floor(Math.random() * 500) + 100);

    // Action distribution
    realtimeStats.actionDistribution = {
        block: Math.floor(Math.random() * 1500) + 500,
        pass: Math.floor(Math.random() * 8000) + 4000,
        other: Math.floor(Math.random() * 100)
    };
}

initializeStats();

// Update stats periodically (simulate real-time data)
setInterval(() => {
    realtimeStats.eventsProcessed += Math.floor(Math.random() * 10);
    realtimeStats.eventsPerSecond = Math.random() * 50 + 10;
    realtimeStats.actionDistribution.block += Math.floor(Math.random() * 5);
    realtimeStats.actionDistribution.pass += Math.floor(Math.random() * 20);
}, 2000);

// ===========================================
// Express App Setup
// ===========================================
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
        kafka: kafkaConsumer ? 'connected' : 'disabled',
        elasticsearch: config.elasticsearch.enabled ? 'enabled' : 'disabled'
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
"Block youtube.com" -> {"type": "domain", "target": "youtube.com", "action": "block", "interface": "both", "protocol": "any", "port": "any", "reason": "User request to block social media", "confidence": 1.0}
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
            // Fallback to Ollama
            const ollamaAvailable = await checkOllama();
            if (!ollamaAvailable) {
                // If Groq failed and Ollama not available, try Groq anyway
                if (groqClient) {
                    ruleData = await generateRuleWithGroq(prompt, contextData);
                } else {
                    return res.status(503).json({
                        error: 'No AI provider available',
                        details: 'Groq not configured and Ollama not running'
                    });
                }
            } else {
                ruleData = await generateRuleWithOllama(prompt, contextData);
            }
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

        // Add default values if missing
        if (!ruleData.confidence) ruleData.confidence = 0.8;
        if (!ruleData.interface) ruleData.interface = 'both';
        if (!ruleData.protocol) ruleData.protocol = 'any';
        if (!ruleData.port) ruleData.port = 'any';

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
// Pending Approvals Endpoint
// ===========================================
app.get('/api/approvals/pending', (req, res) => {
    try {
        const logs = JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, 'utf8'));
        const pending = logs.filter(entry => entry.status === 'pending_approval');
        res.json(pending);
    } catch (error) {
        res.json([]);
    }
});

app.post('/api/approvals/:timestamp/approve', async (req, res) => {
    const { timestamp } = req.params;

    try {
        let logs = JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, 'utf8'));
        const entry = logs.find(e => e.timestamp === timestamp);

        if (!entry) {
            return res.status(404).json({ error: 'Approval not found' });
        }

        // Re-apply the rule with approved flag
        const response = await axios.post(`http://localhost:${config.port}/api/apply-rule`, {
            rule: entry.rule,
            approved: true
        });

        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===========================================
// Elasticsearch Log Search (Optional)
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

// ===========================================
// Threat Intelligence Endpoints
// ===========================================
app.get('/api/threats/summary', async (req, res) => {
    // Return mock threat summary
    res.json({
        severityCounts: [
            { key: 1, doc_count: Math.floor(Math.random() * 10) + 5 },
            { key: 2, doc_count: Math.floor(Math.random() * 20) + 10 },
            { key: 3, doc_count: Math.floor(Math.random() * 50) + 30 }
        ],
        categories: [
            { key: 'Attempted Information Leak', doc_count: Math.floor(Math.random() * 30) + 10 },
            { key: 'Web Application Attack', doc_count: Math.floor(Math.random() * 20) + 5 },
            { key: 'Potential Corporate Privacy Violation', doc_count: Math.floor(Math.random() * 15) + 3 }
        ],
        topAttackers: [
            { key: '203.0.113.50', doc_count: Math.floor(Math.random() * 20) + 10 },
            { key: '198.51.100.25', doc_count: Math.floor(Math.random() * 15) + 5 },
            { key: '192.0.2.100', doc_count: Math.floor(Math.random() * 10) + 3 }
        ],
        recentAlerts: realtimeStats.alerts.slice(0, 5),
        anomalyCount: Math.floor(Math.random() * 10) + 3,
        classifications: [
            { key: 'port_scan', doc_count: Math.floor(Math.random() * 10) + 3 },
            { key: 'brute_force', doc_count: Math.floor(Math.random() * 5) + 2 }
        ]
    });
});

// ===========================================
// Mock Data Generators
// ===========================================
function generateMockLogs(count = 50) {
    const logs = [];
    const actions = ['pass', 'block'];
    const protocols = ['TCP', 'UDP', 'ICMP'];
    const interfaces = ['wan', 'lan'];

    for (let i = 0; i < count; i++) {
        const timestamp = new Date(Date.now() - Math.random() * 3600000);
        logs.push({
            id: `log-${Date.now()}-${i}`,
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
// Socket.IO Connection Handler (Terminal + Stats)
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
            config.kafka.topics.realtimeMetrics
        ],
        fromBeginning: false
    });

    await kafkaConsumer.run({
        eachMessage: async ({ topic, message }) => {
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
║   FirewallAI Backend Server v2.1 (Full Featured)          ║
╠═══════════════════════════════════════════════════════════╣
║  HOST:     ${config.host}:${config.port}                              ║
║  PLATFORM: ${os.platform()}                                       ║
╠═══════════════════════════════════════════════════════════╣
║  AI PROVIDER: ${config.ai.provider.toUpperCase().padEnd(42)}║
║  - Groq:   ${groqClient ? '✓ Ready' : '✗ Not configured'}                                   ║
║  - Ollama: ${ollamaReady ? '✓ Ready' : '✗ Not running'}                                   ║
╠═══════════════════════════════════════════════════════════╣
║  ENDPOINTS:                                               ║
║  - Health:       GET  /health                             ║
║  - AI Status:    GET  /api/ai/providers                   ║
║  - Switch AI:    POST /api/ai/switch                      ║
║  - Gen Rule:     POST /api/generate-rule                  ║
║  - Apply Rule:   POST /api/apply-rule                     ║
║  - Realtime:     GET  /api/stats/realtime                 ║
║  - Audit Log:    GET  /api/audit-log                      ║
║  - Log Search:   GET  /api/logs/search                    ║
║  - Threats:      GET  /api/threats/summary                ║
╚═══════════════════════════════════════════════════════════╝
    `);
    });
}

start().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[SERVER] Shutting down...');
    if (kafkaConsumer) await kafkaConsumer.disconnect();
    if (kafkaProducer) await kafkaProducer.disconnect();
    server.close(() => process.exit(0));
});
