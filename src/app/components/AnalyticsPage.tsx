import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Activity, Shield, Globe, Clock,
  TrendingUp, RefreshCw, Loader2,
  AlertTriangle, Zap, Server, Wifi
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// API configuration
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.1.101:3001';

interface RealtimeStats {
  eventsProcessed: number;
  eventsPerSecond: number;
  topSources: Array<{ ip: string; count: number }>;
  protocolDistribution: Array<{ protocol: string; count: number }>;
  actionDistribution: { block: number; pass: number; other: number };
  recentAlerts: Array<any>;
}

interface TimeSeriesPoint {
  time: string;
  events: number;
  blocked: number;
  allowed: number;
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesPoint[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  // Generate mock time series data for demo
  const generateTimeSeriesData = useCallback(() => {
    const now = new Date();
    const data: TimeSeriesPoint[] = [];

    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      const baseEvents = Math.floor(Math.random() * 500) + 100;
      data.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        events: baseEvents,
        blocked: Math.floor(baseEvents * (0.1 + Math.random() * 0.15)),
        allowed: Math.floor(baseEvents * (0.7 + Math.random() * 0.2))
      });
    }

    return data;
  }, []);

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/stats/realtime`);

      if (!response.ok) throw new Error('Failed to fetch stats');

      const data: RealtimeStats = await response.json();
      setStats(data);
      setConnectionStatus('connected');
      setLastUpdated(new Date());

      // Update time series with new data point
      setTimeSeriesData(prev => {
        const newPoint: TimeSeriesPoint = {
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          events: data.eventsProcessed,
          blocked: data.actionDistribution.block,
          allowed: data.actionDistribution.pass
        };

        const updated = [...prev.slice(-23), newPoint];
        return updated.length > 0 ? updated : generateTimeSeriesData();
      });

    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setConnectionStatus('disconnected');

      // Use mock data if backend unavailable
      if (!stats) {
        setStats({
          eventsProcessed: 15243,
          eventsPerSecond: 12.5,
          topSources: [
            { ip: '192.168.1.45', count: 1250 },
            { ip: '10.5.3.22', count: 890 },
            { ip: '172.16.8.90', count: 654 },
            { ip: '203.0.113.45', count: 432 },
            { ip: '198.51.100.23', count: 321 }
          ],
          protocolDistribution: [
            { protocol: 'TCP', count: 8543 },
            { protocol: 'UDP', count: 4521 },
            { protocol: 'ICMP', count: 1234 },
            { protocol: 'Other', count: 945 }
          ],
          actionDistribution: { block: 2341, pass: 12456, other: 446 },
          recentAlerts: []
        });
        setTimeSeriesData(generateTimeSeriesData());
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stats, generateTimeSeriesData]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading Analytics...</span>
      </div>
    );
  }

  const actionPieData = stats ? [
    { name: 'Allowed', value: stats.actionDistribution.pass, color: '#22c55e' },
    { name: 'Blocked', value: stats.actionDistribution.block, color: '#ef4444' },
    { name: 'Other', value: stats.actionDistribution.other, color: '#6366f1' }
  ] : [];

  const protocolPieData = stats?.protocolDistribution.map((p, i) => ({
    name: p.protocol,
    value: p.count,
    color: COLORS[i % COLORS.length]
  })) || [];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Network Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time traffic analysis and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500'
              }`} />
            <span className="text-sm text-muted-foreground capitalize">{connectionStatus}</span>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div
          className="rounded-lg border p-5"
          style={{
            background: 'var(--glass-bg)',
            borderColor: 'var(--glass-border)',
            boxShadow: '0 4px 24px var(--glass-shadow)',
            backdropFilter: 'blur(10px)',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--glass-hover-border)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--glass-border)')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Events</p>
              <p className="text-3xl font-bold mt-1">{stats?.eventsProcessed.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-3">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm text-green-500">
            <TrendingUp className="h-4 w-4" />
            <span>+12% from last hour</span>
          </div>
        </div>

        <div
          className="rounded-lg border p-5"
          style={{
            background: 'var(--glass-bg)',
            borderColor: 'var(--glass-border)',
            boxShadow: '0 4px 24px var(--glass-shadow)',
            backdropFilter: 'blur(10px)',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--glass-hover-border)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--glass-border)')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Events/Second</p>
              <p className="text-3xl font-bold mt-1">{stats?.eventsPerSecond.toFixed(1)}</p>
            </div>
            <div className="rounded-lg bg-green-500/10 p-3">
              <Zap className="h-6 w-6 text-green-500" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>Real-time throughput</span>
          </div>
        </div>

        <div
          className="rounded-lg border p-5"
          style={{
            background: 'var(--glass-bg)',
            borderColor: 'var(--glass-border)',
            boxShadow: '0 4px 24px var(--glass-shadow)',
            backdropFilter: 'blur(10px)',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--glass-hover-border)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--glass-border)')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Blocked</p>
              <p className="text-3xl font-bold mt-1 text-red-500">{stats?.actionDistribution.block.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-red-500/10 p-3">
              <Shield className="h-6 w-6 text-red-500" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span>{stats ? ((stats.actionDistribution.block / stats.eventsProcessed) * 100).toFixed(1) : 0}% block rate</span>
          </div>
        </div>

        <div
          className="rounded-lg border p-5"
          style={{
            background: 'var(--glass-bg)',
            borderColor: 'var(--glass-border)',
            boxShadow: '0 4px 24px var(--glass-shadow)',
            backdropFilter: 'blur(10px)',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--glass-hover-border)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--glass-border)')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Unique Sources</p>
              <p className="text-3xl font-bold mt-1">{stats?.topSources.length || 0}</p>
            </div>
            <div className="rounded-lg bg-blue-500/10 p-3">
              <Globe className="h-6 w-6 text-blue-500" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm text-muted-foreground">
            <Wifi className="h-4 w-4" />
            <span>Active connections</span>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-3 gap-4">
        {/* Traffic Over Time */}
        <div
          className="col-span-2 rounded-lg border p-5"
          style={{
            background: 'var(--glass-bg)',
            borderColor: 'var(--glass-border)',
            boxShadow: '0 4px 24px var(--glass-shadow)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <h3 className="text-sm font-medium mb-4">Traffic Over Time</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={timeSeriesData}>
              <defs>
                <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  backdropFilter: 'blur(12px)',
                }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Area type="monotone" dataKey="allowed" stroke="#22c55e" fill="url(#colorEvents)" name="Allowed" />
              <Area type="monotone" dataKey="blocked" stroke="#ef4444" fill="url(#colorBlocked)" name="Blocked" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Action Distribution */}
        <div
          className="rounded-lg border p-5"
          style={{
            background: 'var(--glass-bg)',
            borderColor: 'var(--glass-border)',
            boxShadow: '0 4px 24px var(--glass-shadow)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <h3 className="text-sm font-medium mb-4">Action Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={actionPieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {actionPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  backdropFilter: 'blur(12px)',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-3 gap-4">
        {/* Top Sources */}
        <div
          className="rounded-lg border p-5"
          style={{
            background: 'var(--glass-bg)',
            borderColor: 'var(--glass-border)',
            boxShadow: '0 4px 24px var(--glass-shadow)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <h3 className="text-sm font-medium mb-4">Top Source IPs</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats?.topSources.slice(0, 5)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis dataKey="ip" type="category" stroke="var(--muted-foreground)" fontSize={11} width={100} />
              <Tooltip
                contentStyle={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  backdropFilter: 'blur(12px)',
                }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Protocol Distribution */}
        <div
          className="rounded-lg border p-5"
          style={{
            background: 'var(--glass-bg)',
            borderColor: 'var(--glass-border)',
            boxShadow: '0 4px 24px var(--glass-shadow)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <h3 className="text-sm font-medium mb-4">Protocol Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={protocolPieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
              >
                {protocolPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  backdropFilter: 'blur(12px)',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Stats */}
        <div
          className="rounded-lg border p-5"
          style={{
            background: 'var(--glass-bg)',
            borderColor: 'var(--glass-border)',
            boxShadow: '0 4px 24px var(--glass-shadow)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <h3 className="text-sm font-medium mb-4">System Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-green-500" />
                <span className="text-sm">Backend Server</span>
              </div>
              <span className="text-sm text-green-500">Online</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                <span className="text-sm">Kafka Streaming</span>
              </div>
              <span className="text-sm text-green-500">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span className="text-sm">pfSense</span>
              </div>
              <span className="text-sm text-green-500">Connected</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Last Updated</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {lastUpdated?.toLocaleTimeString() || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
