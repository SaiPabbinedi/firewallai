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
import { EnhancedGlassCard } from './ui/EnhancedGlassCard';
import { LiveAttackPulse } from './ui/LiveAttackPulse';
import { SecurityHealthScore } from './ui/SecurityHealthScore';
import { EmergencyLockdown } from './ui/EmergencyLockdown';
import { NetworkPulse } from './ui/NetworkPulse';

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

// ── Severity config ───────────────────────────────────────────────
const severityConfig = {
  high:   { bg: 'rgba(255,59,87,0.08)',    border: 'rgba(255,59,87,0.25)',    dot: '#ff3b57',  label: 'HIGH'   },
  medium: { bg: 'rgba(251,191,36,0.08)',   border: 'rgba(251,191,36,0.25)',   dot: '#fbbf24',  label: 'MED'    },
  low:    { bg: 'rgba(0,217,255,0.06)',    border: 'rgba(0,217,255,0.2)',     dot: '#00d9ff',  label: 'LOW'    },
};

export function DashboardPageEnhanced() {
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
    { time: '23:59', packets: 5100 },
  ]);

  const [aiInsights] = useState([
    { severity: 'high',   title: 'Possible brute-force attack detected',    description: 'Multiple failed SSH attempts from 192.168.1.45',              time: '2 minutes ago'  },
    { severity: 'medium', title: 'Rule consolidation suggested',             description: '8 redundant firewall rules identified for optimization',       time: '15 minutes ago' },
    { severity: 'low',    title: 'Policy drift detected in DMZ zone',        description: 'Configuration variance from baseline detected',                time: '1 hour ago'     },
  ]);

  const fetchBlocklist = async () => {
    setIsLoadingBlocklist(true);
    try {
      const response = await fetch(`${backendUrl}/ai.txt`);
      if (response.ok) {
        const text = await response.text();
        const domains = text.split('\n').filter(d => d.trim() !== '');
        const now = new Date();
        const reasons = ['Policy Violation', 'Malware', 'Phishing', 'Adult Content', 'Social Media'];
        const blockedList: BlockedDomain[] = domains.map((domain, index) => ({
          domain: domain.trim(),
          blockedAt: new Date(now.getTime() - Math.random() * 86400000 * 7).toLocaleString(),
          reason: reasons[index % 5]!,
          attempts: Math.floor(Math.random() * 500) + 10,
        }));
        setBlockedDomains(blockedList);
      }
    } catch {
      setBlockedDomains([
        { domain: 'example.com',   blockedAt: '2025-01-25 09:30:00', reason: 'Policy Violation', attempts: 156 },
        { domain: 'facebook.com',  blockedAt: '2025-01-25 08:15:00', reason: 'Social Media',      attempts: 342 },
        { domain: 'instagram.com', blockedAt: '2025-01-24 14:22:00', reason: 'Social Media',      attempts: 289 },
        { domain: 'bing.com',      blockedAt: '2025-01-23 11:45:00', reason: 'Policy Violation',  attempts: 45  },
      ]);
    }
    setIsLoadingBlocklist(false);
  };

  const generateBlockEvent = (): BlockEvent => {
    const domains = blockedDomains.length > 0
      ? blockedDomains.map(d => d.domain)
      : ['facebook.com', 'instagram.com', 'example.com', 'bing.com'];
    const sourceIPs = ['192.168.1.45', '192.168.1.102', '192.168.1.78', '10.0.0.15', '172.16.0.23'];
    return {
      domain:   domains[Math.floor(Math.random() * domains.length)]!,
      timestamp: new Date().toLocaleTimeString(),
      sourceIP: sourceIPs[Math.floor(Math.random() * sourceIPs.length)]!,
      action:   'BLOCKED',
    };
  };

  useEffect(() => { fetchBlocklist(); }, [backendUrl]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogsPerSecond(prev => {
        const change = Math.floor(Math.random() * 200) - 100;
        return Math.max(2000, Math.min(4000, prev + change));
      });
      if (Math.random() > 0.7) {
        setActiveThreats(prev => Math.max(0, prev + (Math.random() > 0.5 ? 1 : -1)));
      }
      setNetworkTrafficData(prev => {
        const newData = [...prev];
        newData.shift();
        const lastValue = newData[newData.length - 1]?.packets ?? 5000;
        const change = Math.floor(Math.random() * 2000) - 1000;
        newData.push({
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          packets: Math.max(1000, Math.min(12000, lastValue + change)),
        });
        return newData;
      });
      if (Math.random() > 0.6 && blockedDomains.length > 0) {
        setBlockEvents(prev => [generateBlockEvent(), ...prev.slice(0, 9)]);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [blockedDomains]);

  const statCards = [
    {
      title: 'Active Threats',
      value: activeThreats.toString(),
      sub: '+3 from last hour',
      icon: AlertTriangle,
      accent: '#ff3b57',
      accentBg: 'rgba(255,59,87,0.1)',
      accentBorder: 'rgba(255,59,87,0.25)',
      variant: 'danger' as const,
    },
    {
      title: 'Logs / Second',
      value: logsPerSecond.toLocaleString(),
      sub: 'Real-time metric',
      icon: Activity,
      accent: 'var(--primary)',
      accentBg: 'rgba(0,217,255,0.08)',
      accentBorder: 'rgba(0,217,255,0.25)',
      variant: 'accent' as const,
    },
    {
      title: 'Firewall Rules',
      value: ruleCount.toString(),
      sub: '12 optimized this week',
      icon: Shield,
      accent: '#10b981',
      accentBg: 'rgba(16,185,129,0.08)',
      accentBorder: 'rgba(16,185,129,0.25)',
      variant: 'success' as const,
    },
    {
      title: 'Risk Level',
      value: riskLevel,
      sub: 'Elevated from Low',
      icon: TrendingUp,
      accent: '#fbbf24',
      accentBg: 'rgba(251,191,36,0.08)',
      accentBorder: 'rgba(251,191,36,0.25)',
      variant: 'default' as const,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Security Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time pfSense firewall monitoring and threat intelligence
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <span className="text-emerald-500 font-medium">Live</span>
          </div>
          <span>·</span>
          <span className="font-mono">{backendUrl}</span>
        </div>
      </div>

      {/* ── Enhanced Bento Grid ─────────────────────────────────────────── */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'auto auto auto auto',
        }}
      >
        {/* Row 1: 4 stat cards with EnhancedGlassCard */}
        {statCards.map((sc, i) => {
          const Icon = sc.icon;
          return (
            <EnhancedGlassCard
              key={i}
              variant={sc.variant}
              glow={true}
              style={{ gridColumn: i + 1, gridRow: 1 }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{sc.title}</p>
                  <p className="mt-1.5 text-2xl font-bold text-foreground leading-none">{sc.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{sc.sub}</p>
                </div>
                <div
                  className="rounded-lg p-2 ml-3 shrink-0"
                  style={{ background: sc.accentBg, border: `1px solid ${sc.accentBorder}` }}
                >
                  <Icon className="h-4 w-4" style={{ color: sc.accent }} />
                </div>
              </div>
            </EnhancedGlassCard>
          );
        })}

        {/* Row 2, Col 4: Security Health Score (tall card) */}
        <EnhancedGlassCard
          variant="accent"
          glow={true}
          style={{ gridColumn: 4, gridRow: '2 / 4' }}
          className="flex flex-col"
        >
          <SecurityHealthScore />
        </EnhancedGlassCard>

        {/* Row 2, Col 1–3: Traffic Chart */}
        <EnhancedGlassCard variant="default" style={{ gridColumn: '1 / 4', gridRow: 2 }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Network Traffic</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Packets processed per interval (live)</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-success">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Live
            </span>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={networkTrafficData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                <XAxis dataKey="time" stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                <YAxis stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    color: 'var(--foreground)',
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
        </EnhancedGlassCard>

        {/* Row 3, Col 1: Live Attack Pulse */}
        <EnhancedGlassCard variant="danger" glow={true} style={{ gridColumn: 1, gridRow: 3 }}>
          <LiveAttackPulse />
        </EnhancedGlassCard>

        {/* Row 3, Col 2: Blocked Domains */}
        <EnhancedGlassCard variant="default" style={{ gridColumn: 2, gridRow: 3 }}>
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
        </EnhancedGlassCard>

        {/* Row 3, Col 3: Recent Block Events */}
        <EnhancedGlassCard variant="default" style={{ gridColumn: 3, gridRow: 3 }}>
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
        </EnhancedGlassCard>

        {/* Row 4, Col 1–2: Network Topology Pulse */}
        <EnhancedGlassCard variant="accent" style={{ gridColumn: '1 / 3', gridRow: 4 }}>
          <NetworkPulse />
        </EnhancedGlassCard>

        {/* Row 4, Col 3–4: Emergency Lockdown */}
        <EnhancedGlassCard variant="danger" glow={true} style={{ gridColumn: '3 / 5', gridRow: 4 }}>
          <EmergencyLockdown />
        </EnhancedGlassCard>
      </motion.div>
    </div>
  );
}
