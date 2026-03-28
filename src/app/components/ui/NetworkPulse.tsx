import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Network, Activity } from 'lucide-react';

interface NetworkNode {
  id: string;
  label: string;
  type: 'firewall' | 'server' | 'client' | 'threat';
  x: number;
  y: number;
  active: boolean;
}

interface NetworkFlow {
  id: string;
  from: string;
  to: string;
  intensity: number;
  status: 'normal' | 'warning' | 'critical';
}

export function NetworkPulse() {
  const [nodes, setNodes] = useState<NetworkNode[]>([
    { id: 'fw', label: 'Firewall', type: 'firewall', x: 50, y: 50, active: true },
    { id: 'srv1', label: 'Server 1', type: 'server', x: 20, y: 20, active: true },
    { id: 'srv2', label: 'Server 2', type: 'server', x: 80, y: 20, active: true },
    { id: 'cli1', label: 'Client 1', type: 'client', x: 15, y: 80, active: true },
    { id: 'cli2', label: 'Client 2', type: 'client', x: 85, y: 80, active: true },
    { id: 'threat', label: 'Threat', type: 'threat', x: 50, y: 5, active: false },
  ]);

  const [flows, setFlows] = useState<NetworkFlow[]>([
    { id: '1', from: 'fw', to: 'srv1', intensity: 0.7, status: 'normal' },
    { id: '2', from: 'fw', to: 'srv2', intensity: 0.6, status: 'normal' },
    { id: '3', from: 'fw', to: 'cli1', intensity: 0.5, status: 'normal' },
    { id: '4', from: 'fw', to: 'cli2', intensity: 0.4, status: 'normal' },
  ]);

  // Simulate network activity
  useEffect(() => {
    const interval = setInterval(() => {
      setFlows(prev => prev.map(flow => ({
        ...flow,
        intensity: Math.random() * 0.8 + 0.2,
        status: Math.random() > 0.8 ? 'warning' : 'normal',
      })));

      // Occasionally add threat
      if (Math.random() > 0.85) {
        setNodes(prev => prev.map(n => 
          n.id === 'threat' ? { ...n, active: true } : n
        ));
        setTimeout(() => {
          setNodes(prev => prev.map(n => 
            n.id === 'threat' ? { ...n, active: false } : n
          ));
        }, 2000);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const getNodeColor = (node: NetworkNode) => {
    if (node.type === 'firewall') return '#00d9ff';
    if (node.type === 'server') return '#10b981';
    if (node.type === 'client') return '#8b5cf6';
    if (node.type === 'threat') return node.active ? '#ff3b57' : '#666';
    return '#00d9ff';
  };

  const getFlowColor = (flow: NetworkFlow) => {
    if (flow.status === 'critical') return '#ff3b57';
    if (flow.status === 'warning') return '#fbbf24';
    return '#00d9ff';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Network Topology</h3>
      </div>

      {/* Canvas */}
      <div className="relative w-full bg-muted/20 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <svg className="w-full h-full" viewBox="0 0 100 100">
          {/* Grid background */}
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="var(--glass-border)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" opacity="0.3" />

          {/* Flows (connections) */}
          {flows.map(flow => {
            const fromNode = nodes.find(n => n.id === flow.from);
            const toNode = nodes.find(n => n.id === flow.to);
            if (!fromNode || !toNode) return null;

            return (
              <g key={flow.id}>
                {/* Connection line */}
                <motion.line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={getFlowColor(flow)}
                  strokeWidth={flow.intensity * 1.5}
                  opacity={flow.intensity}
                  animate={{ opacity: [flow.intensity * 0.5, flow.intensity, flow.intensity * 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />

                {/* Flow indicator */}
                <motion.circle
                  cx={fromNode.x + (toNode.x - fromNode.x) * 0.5}
                  cy={fromNode.y + (toNode.y - fromNode.y) * 0.5}
                  r="1.5"
                  fill={getFlowColor(flow)}
                  animate={{
                    cx: [fromNode.x, toNode.x],
                    cy: [fromNode.y, toNode.y],
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map(node => (
            <g key={node.id}>
              {/* Node glow */}
              {node.active && (
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r="6"
                  fill="none"
                  stroke={getNodeColor(node)}
                  strokeWidth="0.5"
                  opacity="0.3"
                  animate={{ r: [6, 8, 6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}

              {/* Node circle */}
              <motion.circle
                cx={node.x}
                cy={node.y}
                r="3"
                fill={getNodeColor(node)}
                animate={node.active ? { r: [3, 3.5, 3] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              />

              {/* Node label */}
              <text
                x={node.x}
                y={node.y + 6}
                textAnchor="middle"
                className="text-[6px] fill-muted-foreground"
              >
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: '#00d9ff' }} />
          <span className="text-muted-foreground">Firewall/Client</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: '#10b981' }} />
          <span className="text-muted-foreground">Server</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: '#ff3b57' }} />
          <span className="text-muted-foreground">Threat</span>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="h-3 w-3 text-primary" />
          <span className="text-muted-foreground">Active Flow</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-muted/20">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Nodes</p>
          <p className="text-sm font-semibold text-foreground">{nodes.length}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Active Flows</p>
          <p className="text-sm font-semibold text-foreground">{flows.length}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Avg Intensity</p>
          <p className="text-sm font-semibold text-foreground">
            {(flows.reduce((a, f) => a + f.intensity, 0) / flows.length).toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  );
}
