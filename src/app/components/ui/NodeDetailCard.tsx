import { Shield, Monitor, Activity, Globe, Server, Skull, Laptop, Database } from 'lucide-react';

export interface NodeDetail {
  id: string;
  label: string;
  ip: string;
  type: string;
  color: string;
  status?: 'active' | 'warning' | 'critical' | 'offline';
  connections?: number;
  traffic?: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
  offline: '#6b7280',
};

function NodeIcon({ type, color }: { type: string; color: string }) {
  const props = { className: 'h-4 w-4', style: { color } } as const;
  switch (type) {
    case 'firewall': return <Shield {...props} />;
    case 'server':   return <Server {...props} />;
    case 'attacker': return <Skull {...props} />;
    case 'client':   return <Laptop {...props} />;
    case 'database': return <Database {...props} />;
    case 'wan':
    case 'external': return <Globe {...props} />;
    case 'switch':   return <Activity {...props} />;
    default:         return <Monitor {...props} />;
  }
}

interface Props {
  node: NodeDetail;
  onDismiss: () => void;
}

export function NodeDetailCard({ node, onDismiss }: Props) {
  const statusColor = node.status ? STATUS_COLORS[node.status] : undefined;

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        borderColor: node.color + '66',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <NodeIcon type={node.type} color={node.color} />
        <p className="text-sm font-semibold text-foreground truncate">{node.label}</p>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">IP</span>
          <span className="font-mono text-foreground">{node.ip}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Type</span>
          <span className="capitalize text-foreground">{node.type}</span>
        </div>
        {node.status && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="capitalize font-medium" style={{ color: statusColor }}>{node.status}</span>
          </div>
        )}
        {node.connections !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Connections</span>
            <span className="font-medium text-foreground">{node.connections.toLocaleString()}</span>
          </div>
        )}
        {node.traffic !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Traffic</span>
            <span className="font-medium text-foreground">{node.traffic.toLocaleString()} pkts</span>
          </div>
        )}
      </div>

      <button
        onClick={onDismiss}
        className="mt-3 w-full rounded border border-border py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}
