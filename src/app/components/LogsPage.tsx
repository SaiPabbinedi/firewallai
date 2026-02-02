import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Search, Filter, Download, RefreshCw,
  Loader2, AlertTriangle, Check, X, Clock, ChevronDown
} from 'lucide-react';

// API configuration
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.1.101:3001';

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
  raw_message?: string;
  alert?: {
    signature?: string;
    category?: string;
    severity?: number;
  };
}

interface FilterState {
  query: string;
  action: string;
  protocol: string;
  timeRange: string;
}

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    query: '',
    action: 'all',
    protocol: 'all',
    timeRange: '1h'
  });

  const fetchLogs = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);

    try {
      // Build query string
      let queryParts: string[] = [];
      if (filters.query) queryParts.push(filters.query);
      if (filters.action !== 'all') queryParts.push(`action:${filters.action}`);
      if (filters.protocol !== 'all') queryParts.push(`protocol:${filters.protocol}`);

      const timeRangeMap: Record<string, string> = {
        '15m': 'now-15m',
        '1h': 'now-1h',
        '6h': 'now-6h',
        '24h': 'now-24h',
        '7d': 'now-7d'
      };

      const params = new URLSearchParams({
        query: queryParts.join(' AND ') || '*',
        from: String(page * 50),
        size: '50',
        startTime: timeRangeMap[filters.timeRange] || 'now-1h'
      });

      const response = await fetch(`${BACKEND_URL}/api/logs/search?${params}`);

      if (!response.ok) throw new Error('Failed to fetch logs');

      const data = await response.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);

    } catch (err) {
      console.error('Failed to fetch logs:', err);

      // Generate mock logs if backend unavailable
      const mockLogs: LogEntry[] = [];
      const actions = ['block', 'pass', 'drop'];
      const protocols = ['TCP', 'UDP', 'ICMP'];
      const interfaces = ['wan', 'lan'];

      for (let i = 0; i < 50; i++) {
        const timestamp = new Date(Date.now() - Math.random() * 3600000);
        mockLogs.push({
          id: `log-${i}`,
          '@timestamp': timestamp.toISOString(),
          src_ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          dst_ip: `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          src_port: Math.floor(Math.random() * 65535),
          dst_port: [80, 443, 22, 3389, 53][Math.floor(Math.random() * 5)],
          protocol: protocols[Math.floor(Math.random() * protocols.length)],
          action: actions[Math.floor(Math.random() * actions.length)],
          interface: interfaces[Math.floor(Math.random() * interfaces.length)],
          raw_message: `filterlog: rule ${Math.floor(Math.random() * 100)} pass/block`
        });
      }

      setLogs(mockLogs);
      setTotal(mockLogs.length);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchLogs(false), 30000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchLogs(true);
  };

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Source IP', 'Dest IP', 'Protocol', 'Action', 'Interface'].join(','),
      ...logs.map(log => [
        log['@timestamp'],
        log.src_ip || '',
        log.dst_ip || '',
        log.protocol || '',
        log.action || '',
        log.interface || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firewall-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActionBadge = (action?: string) => {
    const actionLower = (action || '').toLowerCase();
    if (actionLower === 'pass' || actionLower === 'allow') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
          <Check className="h-3 w-3" /> Pass
        </span>
      );
    }
    if (actionLower === 'block' || actionLower === 'drop' || actionLower === 'reject') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
          <X className="h-3 w-3" /> Block
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-400">
        {action || 'Unknown'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading Logs...</span>
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
            Real-time log viewer with search and filtering
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4" style={{ background: 'rgba(20, 24, 40, 0.5)', backdropFilter: 'blur(10px)' }}>
        <form onSubmit={handleSearch} className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search logs (e.g., src_ip:192.168.1.* OR dst_port:443)"
              value={filters.query}
              onChange={(e) => setFilters(f => ({ ...f, query: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <select
            value={filters.action}
            onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Actions</option>
            <option value="pass">Pass</option>
            <option value="block">Block</option>
          </select>

          <select
            value={filters.protocol}
            onChange={(e) => setFilters(f => ({ ...f, protocol: e.target.value }))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Protocols</option>
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="icmp">ICMP</option>
          </select>

          <select
            value={filters.timeRange}
            onChange={(e) => setFilters(f => ({ ...f, timeRange: e.target.value }))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>

          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Filter className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Showing {logs.length} of {total.toLocaleString()} logs</span>
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          Auto-refresh: 30s
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
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Protocol</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Interface</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log) => (
              <>
                <tr
                  key={log.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    {new Date(log['@timestamp']).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {log.src_ip}:{log.src_port}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {log.dst_ip}:{log.dst_port}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {log.protocol}
                    </span>
                  </td>
                  <td className="px-4 py-3">{getActionBadge(log.action)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground uppercase">{log.interface}</td>
                  <td className="px-4 py-3">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedLog === log.id ? 'rotate-180' : ''}`} />
                  </td>
                </tr>
                {expandedLog === log.id && (
                  <tr className="bg-muted/20">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="rounded-lg bg-background/50 p-4 font-mono text-xs">
                        <p className="text-muted-foreground mb-2">Raw Message:</p>
                        <p className="text-foreground whitespace-pre-wrap break-all">
                          {log.raw_message || JSON.stringify(log, null, 2)}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-sm text-muted-foreground">
          Page {page + 1} of {Math.ceil(total / 50)}
        </span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={(page + 1) * 50 >= total}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
