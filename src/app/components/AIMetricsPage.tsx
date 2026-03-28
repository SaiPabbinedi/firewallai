import { useState, useEffect, useCallback } from 'react';
import {
    Brain, Zap, Shield, Target, TrendingUp, AlertTriangle,
    Timer, Bot, Activity, RefreshCw
} from 'lucide-react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
    RadialBarChart, RadialBar, Legend, Area, AreaChart
} from 'recharts';
import { motion } from 'framer-motion';

const BACKEND_URL = 'http://192.168.1.101:3001';

interface MetricsSnapshot {
    anomalies_detected_total: number;
    rules_generated_total: number;
    avg_classification_confidence: number;
    avg_llm_latency_ms: number;
    avg_anomaly_score: number;
    avg_mttr_seconds: number;
    sub_3s_response_rate: number;
    events_per_second: number;
    events_processed_total: number;
    auto_blocks: number;
    manual_blocks: number;
    sessions_analyzed_total: number;
}

interface AnomalyScoreEntry {
    time: string;
    score: number;
    isAnomaly: boolean;
    classification: string;
}

interface MttrEntry {
    time: string;
    mttr: number;
    classification: string;
    srcIp: string;
}

interface MetricsResponse {
    snapshot: MetricsSnapshot;
    anomalyScores: AnomalyScoreEntry[];
    mttrEntries: MttrEntry[];
    source: string;
}

interface ThreatClassification {
    key: string;
    doc_count: number;
}

interface ThreatSummary {
    severityCounts: Array<{ key: number; doc_count: number }>;
    categories: Array<{ key: string; doc_count: number }>;
    topAttackers: Array<{ key: string; doc_count: number }>;
    anomalyCount: number;
    classifications: ThreatClassification[];
}

const COLORS = ['#00d9ff', '#7c3aed', '#f59e0b', '#ef4444', '#10b981', '#f97316', '#06b6d4', '#ec4899'];

const glassCard = {
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 4px 24px var(--glass-shadow)',
    borderColor: 'var(--glass-border)',
};

const tooltipStyle = {
    backgroundColor: 'var(--glass-bg)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    color: '#e4e7eb',
};

export function AIMetricsPage() {
    const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
    const [threatSummary, setThreatSummary] = useState<ThreatSummary | null>(null);
    const [anomalyHistory, setAnomalyHistory] = useState<Array<{ time: string; score: number }>>([]);
    const [llmLatencyHistory, setLlmLatencyHistory] = useState<Array<{ time: string; latency: number }>>([]);
    const [dataSource, setDataSource] = useState<string>('loading');
    const [isLive, setIsLive] = useState(true);

    const fetchMetrics = useCallback(async () => {
        try {
            const [metricsRes, threatsRes] = await Promise.all([
                fetch(`${BACKEND_URL}/api/metrics/snapshot`).catch(() => null),
                fetch(`${BACKEND_URL}/api/threats/summary`).catch(() => null),
            ]);

            // --- Metrics Snapshot (real data from /api/metrics/snapshot) ---
            if (metricsRes?.ok) {
                const data: MetricsResponse = await metricsRes.json();
                setMetrics(data.snapshot);
                setDataSource(data.source);

                // Use real anomaly score history from API
                if (data.anomalyScores && data.anomalyScores.length > 0) {
                    setAnomalyHistory(
                        data.anomalyScores
                            .slice(-20)
                            .reverse()
                            .map((s: AnomalyScoreEntry) => ({
                                time: new Date(s.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                                score: s.score,
                            }))
                    );
                } else {
                    // Append live data point if no history yet
                    const now = new Date();
                    const tLabel = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    setAnomalyHistory((prev: Array<{ time: string; score: number }>) => {
                        const updated = [...prev, { time: tLabel, score: data.snapshot.avg_anomaly_score }];
                        return updated.slice(-20);
                    });
                }

                // Use real LLM latency from API snapshot
                const now = new Date();
                const tLabel = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                setLlmLatencyHistory((prev: Array<{ time: string; latency: number }>) => {
                    const updated = [...prev, { time: tLabel, latency: data.snapshot.avg_llm_latency_ms }];
                    return updated.slice(-20);
                });
            }

            // --- Threat Summary (real data from /api/threats/summary) ---
            if (threatsRes?.ok) {
                const data: ThreatSummary = await threatsRes.json();
                setThreatSummary(data);
            }

        } catch {
            setDataSource('offline');
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
        if (!isLive) return;
        const interval = setInterval(fetchMetrics, 5000);
        return () => clearInterval(interval);
    }, [fetchMetrics, isLive]);

    const threatDistribution = (threatSummary?.classifications || []).map((c: ThreatClassification, i: number) => ({
        name: c.key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        value: c.doc_count,
        fill: COLORS[i % COLORS.length],
    }));

    const confidenceGaugeData = [
        { name: 'Confidence', value: Math.round((metrics?.avg_classification_confidence || 0) * 100), fill: '#00d9ff' },
    ];

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <Brain className="h-7 w-7 text-primary" />
                        AI & Machine Learning Metrics
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Real-time ML model performance, anomaly detection, and LLM analytics
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded border ${dataSource === 'elasticsearch'
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                        : dataSource === 'mock'
                            ? 'border-[#fbbf24]/50 bg-[#fbbf24]/10 text-[#fbbf24]'
                            : 'border-border bg-muted text-muted-foreground'
                        }`}>
                        {dataSource === 'elasticsearch' ? '🟢 Live ES' : dataSource === 'mock' ? '🟡 Demo Mode' : '⏳ Loading...'}
                    </span>
                    <button
                        onClick={() => setIsLive(!isLive)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${isLive
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                            : 'border-border bg-muted text-muted-foreground'
                            }`}
                    >
                        <div className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                        {isLive ? 'Live' : 'Paused'}
                    </button>
                    <button
                        onClick={fetchMetrics}
                        className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                        title="Refresh now"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    {
                        title: 'Anomalies Detected',
                        value: metrics?.anomalies_detected_total ?? 0,
                        icon: AlertTriangle,
                        color: 'destructive',
                        desc: 'Isolation Forest detections',
                    },
                    {
                        title: 'AI Rules Generated',
                        value: metrics?.rules_generated_total ?? 0,
                        icon: Shield,
                        color: 'primary',
                        desc: 'LLM-recommended firewall rules',
                    },
                    {
                        title: 'Classification Confidence',
                        value: `${Math.round((metrics?.avg_classification_confidence ?? 0) * 100)}%`,
                        icon: Target,
                        color: 'success',
                        desc: 'Random Forest avg confidence',
                    },
                    {
                        title: 'LLM Latency',
                        value: `${Math.round(metrics?.avg_llm_latency_ms ?? 0)}ms`,
                        icon: Zap,
                        color: 'warning',
                        desc: 'Ollama/Groq response time',
                    },
                ].map((card) => {
                    const Icon = card.icon;
                    const colorMap: Record<string, string> = {
                        destructive: 'bg-destructive/10 text-destructive border-destructive/30',
                        primary: 'bg-primary/10 text-primary border-primary/30',
                        success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
                        warning: 'bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30',
                    };

                    return (
                        <div
                            key={card.title}
                            className="rounded-lg border border-border bg-card/50 p-5 backdrop-blur-sm transition-all hover:shadow-lg hover:shadow-primary/5 group"
                            style={{ ...glassCard, ['--hover-border-color' as string]: 'var(--glass-hover-border)' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--glass-hover-border)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--glass-border)')}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">{card.title}</p>
                                    <p className="mt-2 text-3xl font-bold">{card.value}</p>
                                    <p className="mt-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                        {card.desc}
                                    </p>
                                </div>
                                <div className={`rounded-lg border p-2.5 ${colorMap[card.color]}`}>
                                    <Icon className="h-5 w-5" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-2 gap-4">
                {/* Anomaly Score Trend */}
                <div className="rounded-lg border border-border bg-card/50 p-6 backdrop-blur-sm" style={glassCard}>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-semibold">Anomaly Score Trend</h3>
                            <p className="text-xs text-muted-foreground mt-1">Isolation Forest scores (below -0.5 = anomaly)</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="flex items-center gap-1 text-destructive">
                                <div className="h-2 w-2 rounded-full bg-destructive" /> Threshold: -0.5
                            </span>
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={anomalyHistory}>
                                <defs>
                                    <linearGradient id="anomalyGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00d9ff" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#00d9ff" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 217, 255, 0.1)" />
                                <XAxis dataKey="time" stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} />
                                <YAxis stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} domain={[-1, 0.5]} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Area type="monotone" dataKey="score" stroke="#00d9ff" strokeWidth={2} fill="url(#anomalyGradient)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Classification Confidence Gauge */}
                <div className="rounded-lg border border-border bg-card/50 p-6 backdrop-blur-sm" style={glassCard}>
                    <div className="mb-4">
                        <h3 className="font-semibold">Model Confidence & Accuracy</h3>
                        <p className="text-xs text-muted-foreground mt-1">Random Forest classification confidence</p>
                    </div>
                    <div className="h-64 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart
                                cx="50%" cy="50%" innerRadius="60%" outerRadius="80%"
                                barSize={20} data={confidenceGaugeData} startAngle={180} endAngle={0}
                            >
                                <RadialBar
                                    dataKey="value"
                                    cornerRadius={10}
                                    background={{ fill: 'rgba(0, 217, 255, 0.1)' }}
                                />
                                <Legend iconSize={0} content={() => (
                                    <div className="text-center -mt-12">
                                        <div className="text-4xl font-bold text-primary">
                                            {confidenceGaugeData[0]?.value ?? 0}%
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1">Avg Confidence</div>
                                    </div>
                                )} />
                            </RadialBarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-3 gap-4">
                {/* Threat Distribution Pie */}
                <div className="rounded-lg border border-border bg-card/50 p-6 backdrop-blur-sm" style={glassCard}>
                    <h3 className="font-semibold mb-4">Threat Type Distribution</h3>
                    <div className="h-52">
                        {threatDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={threatDistribution}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%" cy="50%"
                                        outerRadius={80}
                                        strokeWidth={2}
                                        stroke="var(--glass-bg)"
                                    >
                                        {threatDistribution.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend
                                        formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                <div className="text-center">
                                    <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    <p>Waiting for threat data...</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* LLM Latency Trend */}
                <div className="rounded-lg border border-border bg-card/50 p-6 backdrop-blur-sm col-span-2" style={glassCard}>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-semibold">LLM Response Latency</h3>
                            <p className="text-xs text-muted-foreground mt-1">Ollama/Groq API call duration</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Bot className="h-4 w-4" />
                            <span>Avg: {Math.round(metrics?.avg_llm_latency_ms ?? 0)}ms</span>
                        </div>
                    </div>
                    <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={llmLatencyHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 217, 255, 0.1)" />
                                <XAxis dataKey="time" stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} />
                                <YAxis stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} unit="ms" />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="latency" fill="#7c3aed" radius={[4, 4, 0, 0]} opacity={0.8} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Info Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-border bg-card/50 p-5 backdrop-blur-sm" style={glassCard}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
                            <Activity className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium">Pipeline Status</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Events/sec</span>
                            <span className="font-mono">{metrics?.events_per_second?.toLocaleString() ?? '-'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Total Processed</span>
                            <span className="font-mono">{metrics?.events_processed_total?.toLocaleString() ?? '-'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Sessions Analyzed</span>
                            <span className="font-mono">{metrics?.sessions_analyzed_total ?? '-'}</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-border bg-card/50 p-5 backdrop-blur-sm" style={glassCard}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                            <Timer className="h-4 w-4 text-emerald-500" />
                        </div>
                        <span className="text-sm font-medium">Response Time</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">MTTR</span>
                            <span className="font-mono text-emerald-500">{metrics?.avg_mttr_seconds?.toFixed(1) ?? '-'}s</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Sub-3s Rate</span>
                            <span className="font-mono text-emerald-500">{metrics?.sub_3s_response_rate?.toFixed(0) ?? '-'}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                            <div
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${metrics?.sub_3s_response_rate ?? 0}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-border bg-card/50 p-5 backdrop-blur-sm" style={glassCard}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-[#7c3aed]/10 border border-[#7c3aed]/30">
                            <TrendingUp className="h-4 w-4 text-[#7c3aed]" />
                        </div>
                        <span className="text-sm font-medium">Defense Stats</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Auto Blocks</span>
                            <span className="font-mono text-[#7c3aed]">{metrics?.auto_blocks ?? '-'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Manual Blocks</span>
                            <span className="font-mono">{metrics?.manual_blocks ?? '-'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Automation Rate</span>
                            <span className="font-mono text-primary">
                                {metrics && (metrics.auto_blocks + metrics.manual_blocks) > 0
                                    ? `${Math.round((metrics.auto_blocks / (metrics.auto_blocks + metrics.manual_blocks)) * 100)}%`
                                    : '-'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </motion.div>
    );
}
