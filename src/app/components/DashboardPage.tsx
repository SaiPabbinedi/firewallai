import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Activity, Shield, TrendingUp,
  Ban, Clock, Globe, RefreshCw,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { KillChainTimeline } from './ui/KillChainTimeline';
import { PredictiveAnomalies } from './ui/PredictiveAnomalies';

interface BlockedDomain {
  domain: string;
  blockedAt: string;
  reason: string;
  attempts: number;
}

interface BlockEvent {
  domain: string;
  timestamp: string;
  sourceIP: string;
  action: string;
}

// ── Animation variants ────────────────────────────────────────────
const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const card = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' as const } },
};

// ── Shared glassmorphism card style ───────────────────────────────
const glassStyle: React.CSSProperties = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid var(--glass-border)',
  boxShadow: '0 4px 24px var(--glass-shadow)',
};

const glassHoverStyle: React.CSSProperties = {
  borderColor: 'var(--glass-hover-border)',
};

function GlassCard({
  className = '',
  style = {},
  children,
  layoutId,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  layoutId?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      layoutId={layoutId}
      variants={card}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={`rounded-xl p-5 transition-shadow ${className}`}
      style={{ ...glassStyle, ...(hovered ? glassHoverStyle : {}), ...style }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </motion.div>
  );
}

// ── Severity config ───────────────────────────────────────────────
const severityConfig = {
  high:   { bg: 'rgba(255,59,87,0.08)',    border: 'rgba(255,59,87,0.25)',    dot: '#ff3b57',  label: 'HIGH'   },
  medium: { bg: 'rgba(251,191,36,0.08)',   border: 'rgba(251,191,36,0.25)',   dot: '#fbbf24',  label: 'MED'    },
  low:    { bg: 'rgba(0,217,255,0.06)',    border: 'rgba(0,217,255,0.2)',     dot: '#00d9ff',  label: 'LOW'    },
};

export function DashboardPage() {
  const [activeThreats, setActiveThreats] = useState(12);
  const [logsPerSecond, setLogsPerSecond] = useState(2847);
  const [ruleCount] = useState(342);
  const [riskLevel] = useState('Medium');
  const [blockedDomains, setBlockedDomains] = useState<BlockedDomain[]>([]);
  const [blockEvents, setBlockEvents] = useState<BlockEvent[]>([]);
  const [isLoadingBlocklist, setIsLoadingBlocklist] = useState(true);
  const [backendUrl] = useState('http://192.168.1.101:3001');

  const [networkTrafficData, setNetworkTrafficData] = useState([
    { time: '00:00', packets: 4200 },
    { time: '04:00', packets: 2100 },
    { time: '08:00', packets: 7800 },
    { time: '12:00', packets: 9200 },
    { time: '16:00', packets: 8500 },
    { time: '20:00', packets: 6300 },
  ]);

  useEffect(() => {
    fetchBlocklist();
    const interval = setInterval(() => {
      setActiveThreats(prev => Math.max(0, prev + (Math.random() > 0.5 ? 1 : -1)));
      setLogsPerSecond(prev => prev + Math.floor(Math.random() * 100 - 50));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchBlocklist = async () => {
    setIsLoadingBlocklist(true);
    try {
      const res = await fetch(`${backendUrl}/api/blocklist`);
      if (res.ok) {
        const data = await res.json();
        setBlockedDomains(data.slice(0, 10));
      } else {
        setBlockedDomains([
          { domain: 'malicious-site.com', blockedAt: '10:45 AM', reason: 'Phishing', attempts: 42 },
          { domain: 'tracker-network.net', blockedAt: '09:12 AM', reason: 'Spyware', attempts: 128 },
          { domain: 'botnet-cnc.org', blockedAt: 'Yesterday', reason: 'C&C Server', attempts: 5 },
        ]);
      }
    } catch (err) {
      setBlockedDomains([
        { domain: 'malicious-site.com', blockedAt: '10:45 AM', reason: 'Phishing', attempts: 42 },
        { domain: 'tracker-network.net', blockedAt: '09:12 AM', reason: 'Spyware', attempts: 128 },
        { domain: 'botnet-cnc.org', blockedAt: 'Yesterday', reason: 'C&C Server', attempts: 5 },
      ]);
    } finally {
      setIsLoadingBlocklist(false);
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Security Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time network protection & AI insights</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-primary">System Live</span>
          </div>
        </div>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {/* Row 1: Stats Cards */}
        <GlassCard className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Threats</p>
            <h2 className="text-2xl font-bold text-foreground">{activeThreats}</h2>
          </div>
        </GlassCard>

        <GlassCard className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <Activity className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Logs / Second</p>
            <h2 className="text-2xl font-bold text-foreground">{logsPerSecond.toLocaleString()}</h2>
          </div>
        </GlassCard>

        <GlassCard className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <AlertTriangle className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Risk Level</p>
            <h2 className="text-2xl font-bold text-orange-400">{riskLevel}</h2>
          </div>
        </GlassCard>

        {/* Row 2: Kill Chain Visualization (Full Width) */}
        <GlassCard style={{ gridColumn: '1 / -1' }}>
          <div className="flex items-center gap-2.5 mb-6">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/25">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Advanced Security Visualization</h3>
              <p className="text-xs text-muted-foreground">Real-time Threat "Kill Chain" progression</p>
            </div>
          </div>
          <KillChainTimeline />
        </GlassCard>

        {/* Row 3: Network Traffic & Predictive Anomalies */}
        <GlassCard style={{ gridColumn: '1 / 3' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/25">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Network Traffic</h3>
                <p className="text-xs text-muted-foreground">Packet flow over last 24h</p>
              </div>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={networkTrafficData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="packets"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--primary)', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard style={{ gridColumn: 3 }}>
          <PredictiveAnomalies />
        </GlassCard>

        {/* Row 4: Blocked Domains & Events */}
        <GlassCard style={{ gridColumn: '1 / 3' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div
                className="p-2 rounded-lg"
                style={{ background: 'rgba(255,59,87,0.1)', border: '1px solid rgba(255,59,87,0.25)' }}
              >
                <Ban className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Blocked Domains</h3>
                <p className="text-xs text-muted-foreground">From blocklist (ai.txt)</p>
              </div>
            </div>
            <button
              onClick={fetchBlocklist}
              className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isLoadingBlocklist ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {isLoadingBlocklist ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {blockedDomains.map((bd, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-lg transition-colors"
                  style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--glass-border)' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-medium text-foreground truncate">{bd.domain}</p>
                      <p className="text-[10px] text-muted-foreground">{bd.reason}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs font-semibold text-destructive">{bd.attempts}×</p>
                    <p className="text-[10px] text-muted-foreground">{bd.blockedAt}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard style={{ gridColumn: 3 }}>
          <div className="flex items-center gap-2.5 mb-4">
            <div
              className="p-2 rounded-lg"
              style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.25)' }}
            >
              <Clock className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Block Events</h3>
              <p className="text-xs text-muted-foreground">Live access attempts</p>
            </div>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {blockEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <Clock className="h-6 w-6 mb-2 opacity-25" />
                <p className="text-xs">Waiting for events…</p>
              </div>
            ) : (
              blockEvents.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-lg"
                  style={{ background: 'rgba(255,59,87,0.05)', border: '1px solid rgba(255,59,87,0.15)' }}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-foreground truncate">{ev.domain}</p>
                    <p className="text-[10px] text-muted-foreground">from {ev.sourceIP}</p>
                  </div>
                  <div className="ml-2 shrink-0">
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(255,59,87,0.12)', color: '#ff3b57' }}
                    >
                      {ev.action}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{ev.timestamp}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
