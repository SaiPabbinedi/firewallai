import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Check, X, RefreshCw,
  Loader2, AlertTriangle, Clock, Copy
} from 'lucide-react';
import { AIRuleGenerator } from './ui/AIRuleGenerator';

// API configuration
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.1.101:3001';

interface FirewallRule {
  id: string;
  type: 'ip' | 'domain';
  target: string;
  action: 'block' | 'allow';
  interface: string;
  protocol: string;
  port: string;
  reason: string;
  confidence?: number;
  status: 'active' | 'pending' | 'failed';
  createdAt: string;
  source: 'manual' | 'ai';
}

interface AuditEntry {
  timestamp: string;
  rule: FirewallRule;
  status: string;
  message?: string;
  approved: boolean;
}

export function FirewallRulesPage() {
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRule, setNewRule] = useState<Partial<FirewallRule>>({
    type: 'ip',
    action: 'block',
    interface: 'both',
    protocol: 'any',
    port: 'any'
  });

  const fetchData = useCallback(async () => {
    try {
      // Fetch audit log
      const auditResponse = await fetch(`${BACKEND_URL}/api/audit-log`);
      if (auditResponse.ok) {
        const auditData = await auditResponse.json();
        setAuditLog(auditData);

        // Extract active rules from audit log
        const activeRules: FirewallRule[] = auditData
          .filter((entry: AuditEntry) => entry.status === 'applied')
          .map((entry: AuditEntry, index: number) => ({
            ...entry.rule,
            id: `rule-${index}`,
            status: 'active' as const,
            createdAt: entry.timestamp,
            source: 'ai' as const
          }));

        setRules(activeRules);

        // Get pending approvals
        const pending = auditData.filter((entry: AuditEntry) => entry.status === 'pending_approval');
        setPendingApprovals(pending);
      }
    } catch (err) {
      console.error('Failed to fetch rules:', err);

      // Mock data
      setRules([
        {
          id: '1',
          type: 'ip',
          target: '192.168.1.45',
          action: 'block',
          interface: 'both',
          protocol: 'any',
          port: 'any',
          reason: 'Brute force attack detected',
          confidence: 0.95,
          status: 'active',
          createdAt: new Date().toISOString(),
          source: 'ai'
        },
        {
          id: '2',
          type: 'domain',
          target: 'malware-site.com',
          action: 'block',
          interface: 'both',
          protocol: 'any',
          port: 'any',
          reason: 'User requested block',
          status: 'active',
          createdAt: new Date().toISOString(),
          source: 'manual'
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApplyRule = async (rule: Partial<FirewallRule>) => {
    setApplying(rule.target || 'new');

    try {
      const response = await fetch(`${BACKEND_URL}/api/apply-rule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule, approved: true })
      });

      const data = await response.json();

      if (data.success) {
        alert(`Rule applied: ${data.message}`);
        fetchData();
      } else if (data.requiresApproval) {
        alert(data.message);
        fetchData();
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Failed to apply rule:', err);
      alert('Failed to apply rule. Check backend connection.');
    } finally {
      setApplying(null);
      setShowAddModal(false);
    }
  };

  const handleDeleteRule = async (rule: FirewallRule) => {
    if (!confirm(`Remove ${rule.type} rule for ${rule.target}?`)) return;

    // Note: This would need a corresponding unblock endpoint in the backend
    // For now, we'll just remove from local state
    setRules(prev => prev.filter(r => r.id !== rule.id));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading Firewall Rules...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Firewall Rules</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage AI-generated and manual firewall rules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Rule
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <h3 className="font-medium text-yellow-500">Pending Approvals ({pendingApprovals.length})</h3>
          </div>
          <div className="space-y-2">
            {pendingApprovals.map((entry, index) => (
              <div key={index} className="flex items-center justify-between rounded-lg bg-background/50 p-3">
                <div>
                  <span className="font-mono text-sm">{entry.rule.target}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({entry.rule.type} • {Math.round((entry.rule.confidence || 0) * 100)}% confidence)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApplyRule({ ...entry.rule, confidence: 1.0 })}
                    disabled={applying === entry.rule.target}
                    className="flex items-center gap-1 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-500 hover:bg-green-500/20 transition-colors"
                  >
                    {applying === entry.rule.target ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Approve
                  </button>
                  <button className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20 transition-colors">
                    <X className="h-3 w-3" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Rule Generator */}
      <div className="rounded-lg border border-border overflow-hidden" style={{ background: 'rgba(20, 24, 40, 0.5)', backdropFilter: 'blur(10px)' }}>
        <div className="border-b border-border px-4 py-3 bg-muted/30">
          <h3 className="font-medium">🤖 AI Rule Generator</h3>
          <p className="text-xs text-muted-foreground mt-1">Use natural language to create firewall rules with AI assistance</p>
        </div>
        <div className="p-4">
          <AIRuleGenerator />
        </div>
      </div>

      {/* Active Rules */}
      <div className="rounded-lg border border-border overflow-hidden" style={{ background: 'rgba(20, 24, 40, 0.5)', backdropFilter: 'blur(10px)' }}>
        <div className="border-b border-border px-4 py-3 bg-muted/30">
          <h3 className="font-medium">Active Rules ({rules.length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/20">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Target</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Interface</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${rule.type === 'ip' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'
                    }`}>
                    {rule.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-sm">
                  <div className="flex items-center gap-2">
                    {rule.target}
                    <button onClick={() => copyToClipboard(rule.target)} className="text-muted-foreground hover:text-foreground">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${rule.action === 'block' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                    }`}>
                    {rule.action === 'block' ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    {rule.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground uppercase">{rule.interface}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${rule.source === 'ai' ? 'bg-primary/10 text-primary' : 'bg-gray-500/10 text-gray-400'
                    }`}>
                    {rule.source === 'ai' ? '🤖 AI' : '👤 Manual'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate" title={rule.reason}>
                  {rule.reason}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDeleteRule(rule)}
                    className="text-red-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No active rules. Add a rule or let AI generate one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Audit Log */}
      <div className="rounded-lg border border-border overflow-hidden" style={{ background: 'rgba(20, 24, 40, 0.5)', backdropFilter: 'blur(10px)' }}>
        <div className="border-b border-border px-4 py-3 bg-muted/30">
          <h3 className="font-medium">Recent Activity</h3>
        </div>
        <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
          {auditLog.slice(0, 10).map((entry, index) => (
            <div key={index} className="px-4 py-3 flex items-center gap-4">
              <div className={`h-2 w-2 rounded-full ${entry.status === 'applied' ? 'bg-green-500' :
                entry.status === 'pending_approval' ? 'bg-yellow-500' :
                  entry.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'
                }`} />
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium">{entry.rule?.action}</span>
                  {' '}
                  <span className="font-mono">{entry.rule?.target}</span>
                </p>
                <p className="text-xs text-muted-foreground">{entry.message || entry.status}</p>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(entry.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
          {auditLog.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              No recent activity
            </div>
          )}
        </div>
      </div>

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-lg border border-border bg-card p-6 w-full max-w-md" style={{ background: 'rgba(20, 24, 40, 0.95)' }}>
            <h3 className="text-lg font-bold mb-4">Add Firewall Rule</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Type</label>
                <select
                  value={newRule.type}
                  onChange={(e) => setNewRule(r => ({ ...r, type: e.target.value as 'ip' | 'domain' }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="ip">IP Address</option>
                  <option value="domain">Domain</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Target</label>
                <input
                  type="text"
                  value={newRule.target || ''}
                  onChange={(e) => setNewRule(r => ({ ...r, target: e.target.value }))}
                  placeholder={newRule.type === 'ip' ? '192.168.1.100' : 'example.com'}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Action</label>
                <select
                  value={newRule.action}
                  onChange={(e) => setNewRule(r => ({ ...r, action: e.target.value as 'block' | 'allow' }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="block">Block</option>
                  <option value="allow">Allow</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Interface</label>
                <select
                  value={newRule.interface}
                  onChange={(e) => setNewRule(r => ({ ...r, interface: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="both">Both (WAN + LAN)</option>
                  <option value="wan">WAN Only</option>
                  <option value="lan">LAN Only</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Reason</label>
                <input
                  type="text"
                  value={newRule.reason || ''}
                  onChange={(e) => setNewRule(r => ({ ...r, reason: e.target.value }))}
                  placeholder="Manual block request"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApplyRule({ ...newRule, confidence: 1.0 })}
                disabled={!newRule.target || applying === 'new'}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {applying === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}