/**
 * ============================================================
 * FirewallAI — NEW API Routes (Patch for server_v2.js)
 * ============================================================
 * 
 * ADD these routes to your existing server_v2.js on the Ubuntu server.
 * Paste them BEFORE the "Start Server" section.
 * 
 * These provide:
 *   1. /api/logs/pfsense       — Real pfSense log fetching via SSH
 *   2. /api/vulnerabilities    — NVD CVE feed (free, no auth needed)
 *   3. /api/chat               — Cybersecurity expert chatbot (Groq/Ollama)
 * ============================================================
 */

// ===========================================
// 1. REAL pfSense Log Fetching via SSH
// ===========================================
// This replaces the mock generateMockLogs() fallback.
// It SSHes into pfSense, runs `clog /var/log/filter.log`,
// parses the BSD syslog + filterlog CSV format, and returns
// structured JSON with full filtering support.

// In-memory cache so we don't SSH on every request
let pfSenseLogCache = {
    logs: [],
    lastFetched: 0,
    isFetching: false
};

const PFSENSE_LOG_CACHE_TTL = 12000; // 12 seconds (frontend polls every 15s)

/**
 * Parse a single pfSense filterlog line into structured JSON.
 * pfSense filterlog format (CSV after the syslog header):
 *   rule,subrule,anchor,tracker,interface,reason,action,direction,ipversion,...
 * For IPv4: ...tos,ecn,ttl,id,offset,flags,protoid,protocol,length,src_ip,dst_ip,...
 * For TCP/UDP: ...src_port,dst_port,...
 */
function parsePfSenseFilterLog(rawLine) {
    // Match syslog header: "Mon DD HH:MM:SS hostname filterlog[pid]: csv..."
    const headerMatch = rawLine.match(
        /^(\w+\s+\d+\s+\d+:\d+:\d+)\s+(\S+)\s+filterlog\[\d+\]:\s+(.+)$/
    );
    if (!headerMatch) return null;

    const [, timestampStr, hostname, csvPart] = headerMatch;
    const fields = csvPart.split(',');

    if (fields.length < 14) return null;

    const ruleNumber = fields[0];
    const iface = fields[4];
    const reason = fields[5];
    const action = fields[6]; // "pass" or "block"
    const direction = fields[7];
    const ipVersion = fields[8];

    let src_ip, dst_ip, protocol, src_port, dst_port, length;

    if (ipVersion === '4' && fields.length >= 19) {
        // IPv4 fields
        length = fields[17];
        src_ip = fields[18];
        dst_ip = fields[19];
        protocol = fields[16];

        // TCP/UDP have port fields after dst_ip
        if ((protocol === 'tcp' || protocol === 'udp') && fields.length >= 22) {
            src_port = parseInt(fields[20], 10);
            dst_port = parseInt(fields[21], 10);
        }
    } else if (ipVersion === '6' && fields.length >= 16) {
        // IPv6 — simplified parsing
        protocol = fields[12];
        src_ip = fields[15];
        dst_ip = fields[16];
        if (fields.length >= 19) {
            src_port = parseInt(fields[17], 10);
            dst_port = parseInt(fields[18], 10);
        }
    }

    // Build timestamp — pfSense uses current year
    const now = new Date();
    const fullTimestamp = new Date(`${timestampStr} ${now.getFullYear()}`);
    if (isNaN(fullTimestamp.getTime())) return null;

    return {
        id: `pf-${fullTimestamp.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
        '@timestamp': fullTimestamp.toISOString(),
        src_ip: src_ip || null,
        dst_ip: dst_ip || null,
        src_port: src_port || null,
        dst_port: dst_port || null,
        protocol: (protocol || '').toUpperCase(),
        action: action || 'unknown',
        interface: iface || '',
        direction: direction || '',
        reason: reason || '',
        rule_id: ruleNumber || '',
        length: length ? parseInt(length, 10) : null,
        hostname,
        raw_message: rawLine.slice(0, 500)
    };
}

async function fetchRealPfSenseLogs() {
    const now = Date.now();

    // Return cache if fresh
    if (now - pfSenseLogCache.lastFetched < PFSENSE_LOG_CACHE_TTL && pfSenseLogCache.logs.length > 0) {
        return pfSenseLogCache.logs;
    }

    // Prevent concurrent SSH sessions
    if (pfSenseLogCache.isFetching) {
        return pfSenseLogCache.logs;
    }

    pfSenseLogCache.isFetching = true;

    const { NodeSSH } = require('node-ssh');
    const sshClient = new NodeSSH();

    try {
        await sshClient.connect({
            host: config.pfsense.host,
            username: config.pfsense.user,
            password: config.pfsense.password,
            readyTimeout: 5000,
        });

        // clog reads the circular log file used by pfSense
        // -f would follow, but we just want a snapshot
        // `tail -500` gives us the last 500 lines
        const result = await sshClient.execCommand(
            'clog /var/log/filter.log | tail -500'
        );

        sshClient.dispose();

        if (!result.stdout) {
            console.warn('[PFSENSE-LOGS] No output from clog command');
            return pfSenseLogCache.logs; // Return stale cache
        }

        const lines = result.stdout.split('\n').filter(l => l.trim());
        const parsed = [];

        for (const line of lines) {
            const entry = parsePfSenseFilterLog(line);
            if (entry) parsed.push(entry);
        }

        // Sort newest first
        parsed.sort((a, b) => new Date(b['@timestamp']).getTime() - new Date(a['@timestamp']).getTime());

        pfSenseLogCache.logs = parsed;
        pfSenseLogCache.lastFetched = Date.now();

        console.log(`[PFSENSE-LOGS] Fetched ${parsed.length} real logs from pfSense`);
        return parsed;

    } catch (err) {
        console.error('[PFSENSE-LOGS] SSH error:', err.message);
        return pfSenseLogCache.logs; // Return stale cache on error
    } finally {
        pfSenseLogCache.isFetching = false;
    }
}

/**
 * Apply filters to the parsed log entries (server-side filtering)
 */
function filterLogs(logs, { query, action, protocol, startTime }) {
    let filtered = [...logs];

    // Time filter
    if (startTime) {
        const timeMap = {
            'now-15m': 15 * 60 * 1000,
            'now-1h': 60 * 60 * 1000,
            'now-6h': 6 * 60 * 60 * 1000,
            'now-24h': 24 * 60 * 60 * 1000,
            'now-7d': 7 * 24 * 60 * 60 * 1000,
        };
        const ms = timeMap[startTime];
        if (ms) {
            const cutoff = new Date(Date.now() - ms);
            filtered = filtered.filter(l => new Date(l['@timestamp']) >= cutoff);
        }
    }

    // Action filter
    if (action && action !== 'all' && action !== '*') {
        filtered = filtered.filter(l =>
            (l.action || '').toLowerCase() === action.toLowerCase()
        );
    }

    // Protocol filter
    if (protocol && protocol !== 'all' && protocol !== '*') {
        filtered = filtered.filter(l =>
            (l.protocol || '').toLowerCase() === protocol.toLowerCase()
        );
    }

    // Free-text query (searches across IP, port, interface, raw_message)
    if (query && query !== '*') {
        const q = query.toLowerCase();

        // Handle structured queries like "action:block" or "src_ip:192.168.*"
        const structuredMatch = q.match(/^(\w+):(.+)$/);
        if (structuredMatch) {
            const [, field, value] = structuredMatch;
            const val = value.replace(/\*/g, '');
            filtered = filtered.filter(l => {
                const fieldValue = String(l[field] || '').toLowerCase();
                return fieldValue.includes(val);
            });
        } else {
            // General text search
            filtered = filtered.filter(l => {
                const searchable = [
                    l.src_ip, l.dst_ip, l.protocol, l.action,
                    l.interface, l.raw_message,
                    String(l.src_port), String(l.dst_port)
                ].join(' ').toLowerCase();
                return searchable.includes(q);
            });
        }
    }

    return filtered;
}

// ── REPLACE your existing /api/logs/search route with this one ──
app.get('/api/logs/search', async (req, res) => {
    const {
        query = '*',
        from = 0,
        size = 50,
        startTime = 'now-1h',
        action = 'all',
        protocol = 'all'
    } = req.query;

    try {
        // Always try real pfSense logs first
        const allLogs = await fetchRealPfSenseLogs();

        if (allLogs.length > 0) {
            // Apply server-side filters
            const filtered = filterLogs(allLogs, {
                query, action, protocol, startTime
            });

            const pageStart = parseInt(from, 10);
            const pageSize = parseInt(size, 10);
            const paged = filtered.slice(pageStart, pageStart + pageSize);

            return res.json({
                logs: paged,
                total: filtered.length,
                source: 'pfsense-ssh',
                cached: Date.now() - pfSenseLogCache.lastFetched < 1000 ? false : true
            });
        }

        // Fallback: try Elasticsearch if enabled
        if (config.elasticsearch.enabled) {
            const esQuery = {
                bool: {
                    must: [
                        query !== '*' ? { query_string: { query } } : { match_all: {} },
                        { range: { '@timestamp': { gte: startTime } } }
                    ]
                }
            };
            if (action !== 'all') esQuery.bool.must.push({ term: { 'action.keyword': action } });
            if (protocol !== 'all') esQuery.bool.must.push({ term: { 'protocol.keyword': protocol } });

            const esRes = await axios.post(`${config.elasticsearch.url}/firewall-events/_search`, {
                query: esQuery,
                sort: [{ '@timestamp': 'desc' }],
                from: parseInt(from, 10),
                size: parseInt(size, 10)
            }, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });

            const logs = esRes.data.hits.hits.map(hit => ({ id: hit._id, ...hit._source }));
            return res.json({ logs, total: esRes.data.hits.total.value, source: 'elasticsearch' });
        }

        // Last resort: mock data (only if pfSense unreachable AND no ES)
        console.warn('[LOGS] No real data source available, returning mock');
        return res.json({
            logs: generateMockLogs(parseInt(size, 10)),
            total: 500,
            source: 'mock'
        });

    } catch (error) {
        console.error('[LOGS ERROR]:', error.message);
        res.json({
            logs: generateMockLogs(parseInt(size || 50, 10)),
            total: 500,
            source: 'mock-fallback',
            error: error.message
        });
    }
});


// ===========================================
// 2. Vulnerability / CVE Feed from NVD API
// ===========================================
// Uses the free NIST NVD REST API v2.0 (no auth required).
// Rate limit: 5 requests per 30 seconds without API key,
// 50 per 30 seconds with a key.

let vulnCache = { data: null, lastFetched: 0 };
const VULN_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

app.get('/api/vulnerabilities', async (req, res) => {
    const { severity, limit = 20, keyword } = req.query;
    const now = Date.now();

    // Return cache if fresh (< 2 hours old)
    if (vulnCache.data && (now - vulnCache.lastFetched) < VULN_CACHE_TTL && !keyword) {
        return res.json(vulnCache.data);
    }

    try {
        // Build NVD API query params
        const params = new URLSearchParams();

        // Get CVEs from the last 14 days
        const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
        params.set('pubStartDate', twoWeeksAgo.toISOString().split('.')[0] + '.000');
        params.set('pubEndDate', new Date().toISOString().split('.')[0] + '.000');
        params.set('resultsPerPage', String(Math.min(parseInt(limit, 10), 50)));

        if (severity && severity !== 'all') {
            // NVD uses cvssV3Severity parameter
            params.set('cvssV3Severity', severity.toUpperCase());
        }

        if (keyword) {
            params.set('keywordSearch', keyword);
        }

        console.log(`[NVD] Fetching: https://services.nvd.nist.gov/rest/json/cves/2.0?${params}`);

        const response = await axios.get(
            `https://services.nvd.nist.gov/rest/json/cves/2.0?${params}`,
            {
                timeout: 15000,
                headers: {
                    'Accept': 'application/json',
                    // If you have an NVD API key, add it here:
                    // 'apiKey': process.env.NVD_API_KEY || ''
                }
            }
        );

        const nvdData = response.data;
        const vulnerabilities = (nvdData.vulnerabilities || []).map(v => {
            const cve = v.cve || {};
            const metrics = cve.metrics || {};

            // Extract CVSS v3.1 score (preferred) or v3.0 or v2.0
            let cvssScore = null;
            let cvssSeverity = 'UNKNOWN';
            let cvssVector = '';

            const v31 = metrics.cvssMetricV31?.[0]?.cvssData;
            const v30 = metrics.cvssMetricV30?.[0]?.cvssData;
            const v2 = metrics.cvssMetricV2?.[0]?.cvssData;

            if (v31) {
                cvssScore = v31.baseScore;
                cvssSeverity = v31.baseSeverity;
                cvssVector = v31.vectorString;
            } else if (v30) {
                cvssScore = v30.baseScore;
                cvssSeverity = v30.baseSeverity;
                cvssVector = v30.vectorString;
            } else if (v2) {
                cvssScore = v2.baseScore;
                cvssSeverity = cvssScore >= 7.0 ? 'HIGH' : cvssScore >= 4.0 ? 'MEDIUM' : 'LOW';
                cvssVector = v2.vectorString;
            }

            // Extract description (English preferred)
            const description = (cve.descriptions || [])
                .find(d => d.lang === 'en')?.value || 'No description available';

            // Extract references
            const references = (cve.references || []).map(ref => ({
                url: ref.url,
                source: ref.source,
                tags: ref.tags || []
            }));

            // Extract weaknesses (CWE)
            const weaknesses = (cve.weaknesses || []).flatMap(w =>
                (w.description || []).map(d => d.value)
            );

            return {
                id: cve.id,
                published: cve.published,
                lastModified: cve.lastModified,
                status: cve.vulnStatus,
                description,
                cvssScore,
                cvssSeverity,
                cvssVector,
                weaknesses,
                references: references.slice(0, 5),
                // Compute a "freshness" tag
                isNew: new Date(cve.published) > new Date(now - 3 * 24 * 60 * 60 * 1000),
                // For the article view — build a rich summary
                fullArticle: {
                    title: `${cve.id}: ${description.slice(0, 80)}...`,
                    body: description,
                    cvss: { score: cvssScore, severity: cvssSeverity, vector: cvssVector },
                    cwe: weaknesses,
                    refs: references,
                    published: cve.published,
                    modified: cve.lastModified,
                }
            };
        });

        const result = {
            totalResults: nvdData.totalResults || vulnerabilities.length,
            vulnerabilities,
            lastFetched: new Date().toISOString(),
            source: 'nvd-api',
            nextRefresh: new Date(now + VULN_CACHE_TTL).toISOString()
        };

        // Cache the result (only for non-keyword queries)
        if (!keyword) {
            vulnCache = { data: result, lastFetched: now };
        }

        res.json(result);

    } catch (error) {
        console.error('[NVD ERROR]:', error.message);

        // Return cached data if available, even if stale
        if (vulnCache.data) {
            return res.json({
                ...vulnCache.data,
                source: 'nvd-api-cached',
                error: 'Using cached data due to API error'
            });
        }

        res.status(502).json({
            error: 'Failed to fetch vulnerability data',
            details: error.message,
            suggestion: 'NVD API may be rate-limited. Try again in 30 seconds.'
        });
    }
});

// Single CVE detail endpoint
app.get('/api/vulnerabilities/:cveId', async (req, res) => {
    const { cveId } = req.params;

    if (!/^CVE-\d{4}-\d+$/.test(cveId)) {
        return res.status(400).json({ error: 'Invalid CVE ID format' });
    }

    try {
        const response = await axios.get(
            `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveId}`,
            { timeout: 10000 }
        );

        const cve = response.data.vulnerabilities?.[0]?.cve;
        if (!cve) {
            return res.status(404).json({ error: 'CVE not found' });
        }

        res.json({ cve, source: 'nvd-api' });
    } catch (error) {
        res.status(502).json({ error: error.message });
    }
});


// ===========================================
// 3. Cybersecurity Expert Chatbot
// ===========================================
// Uses the same Groq/Ollama dual-provider setup.
// Maintains conversation context per session.

const chatSessions = new Map(); // sessionId -> message history

const CHATBOT_SYSTEM_PROMPT = `You are an expert cybersecurity and network engineering assistant integrated into the FirewallAI dashboard.
You help security analysts with:
- Explaining network security concepts, protocols, and threats
- Analyzing firewall logs and identifying suspicious patterns
- Recommending pfSense configurations and best practices
- Interpreting CVE vulnerability reports and advising on mitigation
- MITRE ATT&CK framework mapping and threat classification
- Incident response guidance and remediation steps
- Explaining Suricata IDS rules and alerts
- Network architecture and segmentation advice

You have access to the user's pfSense-based network with these components:
- pfSense firewall (192.168.1.1) with Suricata IDS and pfBlockerNG
- Ubuntu Server (192.168.1.101) running Kafka, Spark, Elasticsearch, Grafana
- Windows 11 dashboard frontend
- Kali Linux attack simulation VM

Be concise, technical, and actionable. Use bullet points for steps.
When discussing vulnerabilities, always mention severity, affected products, and remediation.
If the user provides article/CVE context, analyze it thoroughly.`;

async function chatWithGroq(messages) {
    if (!groqClient) throw new Error('Groq not configured');

    const completion = await groqClient.chat.completions.create({
        messages,
        model: config.ai.groq.model,
        temperature: 0.3,
        max_tokens: 2048,
        top_p: 0.9,
    });

    return completion.choices[0]?.message?.content || '';
}

async function chatWithOllama(messages) {
    // Ollama uses a different message format
    const response = await axios.post(`${config.ai.ollama.url}/api/chat`, {
        model: config.ai.ollama.model,
        messages,
        stream: false,
        options: { temperature: 0.3, num_ctx: 4096 }
    }, { timeout: 60000 });

    return response.data.message?.content || '';
}

app.post('/api/chat', async (req, res) => {
    const { message, sessionId = 'default', context } = req.body;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create session history
    if (!chatSessions.has(sessionId)) {
        chatSessions.set(sessionId, []);
    }
    const history = chatSessions.get(sessionId);

    // Build the full message with optional context
    let userContent = message;
    if (context) {
        userContent = `CONTEXT (from vulnerability article or log data):\n${context}\n\nUSER QUESTION: ${message}`;
    }

    // Add user message to history
    history.push({ role: 'user', content: userContent });

    // Keep only last 20 messages to avoid token limits
    while (history.length > 20) {
        history.shift();
    }

    // Build messages array with system prompt
    const messages = [
        { role: 'system', content: CHATBOT_SYSTEM_PROMPT },
        ...history
    ];

    try {
        let reply;

        if (config.ai.provider === 'groq' && groqClient) {
            reply = await chatWithGroq(messages);
        } else {
            const ollamaAvailable = await checkOllama();
            if (ollamaAvailable) {
                reply = await chatWithOllama(messages);
            } else if (groqClient) {
                reply = await chatWithGroq(messages);
            } else {
                return res.status(503).json({
                    error: 'No AI provider available',
                    details: 'Both Groq and Ollama are offline'
                });
            }
        }

        // Add assistant reply to history
        history.push({ role: 'assistant', content: reply });

        res.json({
            reply,
            sessionId,
            provider: config.ai.provider,
            messageCount: history.length
        });

    } catch (error) {
        console.error('[CHAT ERROR]:', error.message);
        res.status(500).json({
            error: 'Chat failed',
            details: error.message
        });
    }
});

// Clear chat session
app.delete('/api/chat/:sessionId', (req, res) => {
    chatSessions.delete(req.params.sessionId);
    res.json({ success: true });
});
