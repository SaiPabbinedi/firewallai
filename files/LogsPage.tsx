import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Filter, Download, RefreshCw,
  Loader2, Check, X, Clock, ChevronDown, Wifi, WifiOff, Database
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.1.101:3001';

// ── Refresh interval: 15 seconds as requested ──
const REFRESH_INTERVAL_MS = 15_000;

interface LogEntry {
  id: string;
  '@timestamp': string;
  src_ip?: string;
  dst_ip?: string;
  src_port?: number;
  dst_port?: number;
  protocol?: string;
  action?: string;
  interface?: string;
  direction?: string;
  reason?: string;
  rule_id?: string;
  length?: number;
  raw_message?: string;
}

interface FilterState {
  query: string;
  action: string;
  protocol: string;
  timeRange: string;
}

interface LogsResponse {
  logs: LogEntry[];
  total: number;
  source: string;
  error?: string;
}

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [dataSource, setDataSource] = useState<string>('loading');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(15);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    query: '',
    action: 'all',
    protocol: 'all',
    timeRange: '1h'
  });

  const fetchLogs = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);

    try {
      const timeRangeMap: Record<string, string> = {
        '15m': 'now-15m', '1h': 'now-1h', '6h': 'now-6h',
        '24h': 'now-24h', '7d': 'now-7d'
      };

      const params = new URLSearchParams({
        query: filters.query || '*',
        from: String(page * 50),
        size: '50',
        startTime: timeRangeMap[filters.timeRange] || 'now-1h',
        action: filters.action,
        protocol: filters.protocol
      });

      const response = await fetch(`${BACKEND_URL}/api/logs/search?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: LogsResponse = await response.json();

      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setDataSource(data.source || 'unknown');
      setLastRefreshTime(new Date());
      setCountdown(15);

    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setDataSource('error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, page]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (autoRefresh) {
      intervalRef.current = setInterval(() => fetchLogs(false), REFRESH_INTERVAL_MS);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => (prev <= 1 ? 15 : prev - 1));
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRefresh, fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchLogs(true);
  };

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Source IP', 'Source Port', 'Dest IP', 'Dest Port', 'Protocol', 'Action', 'Interface', 'Direction', 'Rule'].join(','),
      ...logs.map(log => [
        log['@timestamp'], log.src_ip || '', log.src_port || '',
        log.dst_ip || '', log.dst_port || '', log.protocol || '',
        log.action || '', log.interface || '', log.direction || '',
        log.rule_id || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pfsense-logs-${new Date().toISOString().slice(0, 16)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActionBadge = (action?: string) => {
    const a = (action || '').toLowerCase();
    if (a === 'pass') {
      return <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500"><Check className="h-3 w-3" />pass</span>;
    }
    if (a === 'block') {
      return <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500"><X className="h-3 w-3" />block</span>;
    }
    return <span className="inline-flex rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-400">{action || '?'}</span>;
  };

  const getSourceBadge = () => {
    const badges: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      'pfsense-ssh': { color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400', icon: <Wifi className="h-3 w-3" />, label: 'pfSense Live' },
      'elasticsearch': { color: 'border-blue-500/50 bg-blue-500/10 text-blue-400', icon: <Database className="h-3 w-3" />, label: 'Elasticsearch' },
      'mock': { color: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400', icon: <WifiOff className="h-3 w-3" />, label: 'Demo Data' },
      'mock-fallback': { color: 'border-red-500/50 bg-red-500/10 text-red-400', icon: <WifiOff className="h-3 w-3" />, label: 'Offline' },
      'error': { color: 'border-red-500/50 bg-red-500/10 text-red-400', icon: <WifiOff className="h-3 w-3" />, label: 'Error' },
    };
    const b = badges[dataSource] || badges['mock'];
    return (
      <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${b!.color}`}>
        {b!.icon}{b!.label}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Connecting to pfSense logs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Firewall Logs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time pfSense filterlog viewer with live filtering
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getSourceBadge()}
          <button onClick={handleExport} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <Download className="h-4 w-4" />Export
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${autoRefresh ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-border bg-card text-muted-foreground'}`}
          >
            <div className={`h-2 w-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
            {autoRefresh ? `Live (${countdown}s)` : 'Paused'}
          </button>
          <button onClick={() => fetchLogs(true)} disabled={refreshing} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters — these now actually work with the backend */}
      <div className="rounded-lg border border-border bg-card p-4" style={{ background: 'rgba(20, 24, 40, 0.5)', backdropFilter: 'blur(10px)' }}>
        <form onSubmit={handleSearch} className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search logs (IP, port, interface, or raw text)..."
              value={filters.query}
              onChange={(e) => setFilters(f => ({ ...f, query: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <select value={filters.action} onChange={(e) => { setFilters(f => ({ ...f, action: e.target.value })); setPage(0); }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="all">All Actions</option>
            <option value="pass">Pass</option>
            <option value="block">Block</option>
          </select>

          <select value={filters.protocol} onChange={(e) => { setFilters(f => ({ ...f, protocol: e.target.value })); setPage(0); }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="all">All Protocols</option>
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="icmp">ICMP</option>
          </select>

          <select value={filters.timeRange} onChange={(e) => { setFilters(f => ({ ...f, timeRange: e.target.value })); setPage(0); }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="15m">Last 15 min</option>
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>

          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Filter className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Results info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total > 0 ? `${logs.length} of ${total.toLocaleString()} logs` : 'No logs match filters'}
          {dataSource === 'pfsense-ssh' && ' (from pfSense via SSH)'}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {lastRefreshTime ? `Last: ${lastRefreshTime.toLocaleTimeString()}` : 'Fetching...'}
          {autoRefresh && ` · Next in ${countdown}s`}
        </span>
      </div>

      {/* Logs Table */}
      <div className="rounded-lg border border-border overflow-hidden" style={{ background: 'rgba(20, 24, 40, 0.5)', backdropFilter: 'blur(10px)' }}>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Time</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Destination</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Proto</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">IF</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dir</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rule</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">
                  {new Date(log['@timestamp']).toLocaleTimeString()}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {log.src_ip}{log.src_port ? `:${log.src_port}` : ''}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {log.dst_ip}{log.dst_port ? `:${log.dst_port}` : ''}
                </td>
                <td className="px-4 py-2.5">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{log.protocol}</span>
                </td>
                <td className="px-4 py-2.5">{getActionBadge(log.action)}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground uppercase">{log.interface}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.direction}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{log.rule_id}</td>
                <td className="px-4 py-2.5">
                  <button onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedLog === log.id ? 'rotate-180' : ''}`} />
                  </button>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                {dataSource === 'error' ? 'Cannot reach pfSense. Check SSH credentials in backend .env' : 'No logs match the current filters'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">Previous</button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {Math.ceil(total / 50)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * 50 >= total} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
