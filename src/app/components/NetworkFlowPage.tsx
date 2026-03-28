import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Shield, Monitor, RefreshCw, Activity, Globe,
  Server, Network, Skull, Laptop, Database,
  Radio, AlertTriangle, Zap, X, Layers, Waypoints,
} from 'lucide-react';
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, Position, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BACKEND_URL } from '@/lib/api';

// ── Shared node detail type ────────────────────────────────────────────────────

interface NodeDetail {
  id: string;
  label: string;
  ip: string;
  type: string;
  color: string;
  glowColor: string;
  description: string;
  status: 'active' | 'warning' | 'critical' | 'offline';
  connections: number;
  traffic: number;
  role: string;
}

// ── Flow canvas types ──────────────────────────────────────────────────────────

interface FlowNode extends NodeDetail {
  x: number; y: number; z: number;
  radius: number;
}

interface FlowEdge { from: string; to: string; }

interface Packet {
  id: number;
  fromId: string; toId: string;
  progress: number;
  speed: number;
  color: string;
  label: string;
  size: number;
}

interface TrafficStat { label: string; count: number; color: string; }

// ── Topology types ─────────────────────────────────────────────────────────────

interface TopoNode {
  id: string; label: string;
  type: 'firewall' | 'server' | 'attacker' | 'client' | 'database' | 'external';
  ip: string; status: 'active' | 'warning' | 'critical' | 'offline';
  connections: number; traffic?: number;
  [key: string]: unknown;
}

interface TopoEdge {
  source: string; target: string;
  protocol?: string; packets?: number;
  status: 'normal' | 'suspicious' | 'malicious';
  label?: string;
}

interface TopoData {
  nodes: TopoNode[];
  edges: TopoEdge[];
  stats: { totalNodes: number; totalConnections: number; anomalousConnections: number; activeFlows: number };
}

// ── Static flow nodes ──────────────────────────────────────────────────────────

const FLOW_NODES: FlowNode[] = [
  { id: 'wan',     label: 'Internet / WAN',   ip: '0.0.0.0/0',     x: 0,    y: -220, z: 0,   radius: 26, color: '#ff6b6b', glowColor: 'rgba(255,107,107,0.4)', type: 'wan',      description: 'Public internet uplink',      status: 'active',   connections: 450, traffic: 48500, role: 'WAN Gateway' },
  { id: 'pfsense', label: 'pfSense Firewall', ip: '192.168.1.1',   x: 0,    y: 0,    z: 0,   radius: 32, color: '#00d9ff', glowColor: 'rgba(0,217,255,0.45)',  type: 'firewall', description: 'Primary network firewall',     status: 'active',   connections: 42,  traffic: 12500, role: 'Firewall / Router' },
  { id: 'switch',  label: 'LAN Switch',       ip: '192.168.1.254', x: 0,    y: 140,  z: 0,   radius: 20, color: '#a78bfa', glowColor: 'rgba(167,139,250,0.4)', type: 'switch',   description: 'Core LAN distribution switch', status: 'active',   connections: 28,  traffic: 9200,  role: 'L2 Switch' },
  { id: 'server',  label: 'Backend Server',   ip: '192.168.1.101', x: -200, y: 280,  z: 60,  radius: 18, color: '#10b981', glowColor: 'rgba(16,185,129,0.4)',  type: 'server',   description: 'Node.js API + Grafana host',   status: 'active',   connections: 18,  traffic: 8400,  role: 'App / Monitoring' },
  { id: 'pc1',     label: 'Workstation 1',    ip: '192.168.1.10',  x: -80,  y: 280,  z: -60, radius: 16, color: '#60a5fa', glowColor: 'rgba(96,165,250,0.4)',  type: 'device',   description: 'Engineer workstation',         status: 'active',   connections: 5,   traffic: 720,   role: 'Client Device' },
  { id: 'pc2',     label: 'Workstation 2',    ip: '192.168.1.11',  x: 80,   y: 280,  z: 60,  radius: 16, color: '#60a5fa', glowColor: 'rgba(96,165,250,0.4)',  type: 'device',   description: 'Secondary workstation',        status: 'warning',  connections: 5,   traffic: 640,   role: 'Client Device' },
  { id: 'iot',     label: 'IoT Hub',          ip: '192.168.1.200', x: 200,  y: 280,  z: -60, radius: 16, color: '#fbbf24', glowColor: 'rgba(251,191,36,0.4)',  type: 'device',   description: 'Smart device aggregation hub', status: 'active',   connections: 8,   traffic: 1100,  role: 'IoT Gateway' },
];

const FLOW_EDGES: FlowEdge[] = [
  { from: 'wan',     to: 'pfsense' },
  { from: 'pfsense', to: 'switch'  },
  { from: 'switch',  to: 'server'  },
  { from: 'switch',  to: 'pc1'     },
  { from: 'switch',  to: 'pc2'     },
  { from: 'switch',  to: 'iot'     },
];

const PACKET_TYPES = [
  { label: 'HTTPS',   color: '#00d9ff', weight: 35 },
  { label: 'HTTP',    color: '#60a5fa', weight: 20 },
  { label: 'DNS',     color: '#10b981', weight: 25 },
  { label: 'BLOCKED', color: '#ff3b57', weight: 10 },
  { label: 'SSH',     color: '#a78bfa', weight:  5 },
  { label: 'ICMP',    color: '#fbbf24', weight:  5 },
];

function weightedRandom() {
  const total = PACKET_TYPES.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of PACKET_TYPES) { r -= t.weight; if (r <= 0) return t; }
  return PACKET_TYPES[0]!;
}

function project(x: number, y: number, z: number, rotY: number, cx: number, cy: number, fov: number) {
  const cos = Math.cos(rotY), sin = Math.sin(rotY);
  const rx = x * cos + z * sin;
  const rz = -x * sin + z * cos;
  const depth = fov + rz + 500;
  const scale = fov / depth;
  return { sx: cx + rx * scale, sy: cy + y * scale, scale };
}

// ── Topology mock data ─────────────────────────────────────────────────────────

const NODE_STYLE: Record<string, { bg: string; border: string; icon: string; glow: string }> = {
  firewall: { bg: '#0c1629', border: '#00d9ff', icon: '#00d9ff', glow: '0 0 15px rgba(0,217,255,0.3)' },
  server:   { bg: '#0c1629', border: '#6366f1', icon: '#818cf8', glow: '0 0 15px rgba(99,102,241,0.3)' },
  attacker: { bg: '#1a0a0a', border: '#ef4444', icon: '#f87171', glow: '0 0 15px rgba(239,68,68,0.3)' },
  client:   { bg: '#0c1629', border: '#22c55e', icon: '#4ade80', glow: '0 0 15px rgba(34,197,94,0.3)' },
  database: { bg: '#0c1629', border: '#f59e0b', icon: '#fbbf24', glow: '0 0 15px rgba(245,158,11,0.3)' },
  external: { bg: '#0c1629', border: '#8b5cf6', icon: '#a78bfa', glow: '0 0 15px rgba(139,92,246,0.3)' },
};

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e', warning: '#f59e0b', critical: '#ef4444', offline: '#6b7280',
};

const EDGE_COLORS: Record<string, string> = {
  normal: '#334155', suspicious: '#f59e0b', malicious: '#ef4444',
};

function getTopoIcon(type: string, color: string) {
  const props = { className: 'h-5 w-5', style: { color } };
  switch (type) {
    case 'firewall': return <Shield {...props} />;
    case 'server':   return <Server {...props} />;
    case 'attacker': return <Skull {...props} />;
    case 'client':   return <Laptop {...props} />;
    case 'database': return <Database {...props} />;
    default:         return <Globe {...props} />;
  }
}

function CustomTopoNode({ data }: { data: TopoNode }) {
  const style = NODE_STYLE[data.type] || NODE_STYLE.external!;
  return (
    <div className="rounded-xl border-2 px-4 py-3 min-w-[140px] transition-all cursor-pointer"
      style={{ background: style.bg, borderColor: style.border, boxShadow: style.glow }}>
      <div className="flex items-center gap-2 mb-1.5">
        {getTopoIcon(data.type, style.icon)}
        <span className="text-xs font-semibold truncate" style={{ color: '#e4e7eb' }}>{data.label}</span>
      </div>
      <div className="text-xs font-mono" style={{ color: '#71788a' }}>{data.ip}</div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[data.status] }} />
          <span className="text-[10px] capitalize" style={{ color: STATUS_COLORS[data.status] }}>{data.status}</span>
        </div>
        <span className="text-[10px]" style={{ color: '#71788a' }}>{data.connections} conn</span>
      </div>
    </div>
  );
}

const topoNodeTypes = { custom: CustomTopoNode };

function generateTopoData(): TopoData {
  const nodes: TopoNode[] = [
    { id: 'pfsense',      label: 'pfSense Firewall',  type: 'firewall', ip: '192.168.1.1',       status: 'active',   connections: 42,  traffic: 12500 },
    { id: 'ubuntu',       label: 'Ubuntu Server',     type: 'server',   ip: '192.168.1.101',     status: 'active',   connections: 28,  traffic: 8400  },
    { id: 'windows',      label: 'Windows Dashboard', type: 'client',   ip: '192.168.1.100',     status: 'active',   connections: 5,   traffic: 720   },
    { id: 'kali',         label: 'Kali Linux',        type: 'attacker', ip: '192.168.1.103',     status: 'warning',  connections: 15,  traffic: 3200  },
    { id: 'elasticsearch',label: 'Elasticsearch',     type: 'database', ip: '192.168.1.101:9200',status: 'active',   connections: 12,  traffic: 5600  },
    { id: 'kafka',        label: 'Kafka Broker',      type: 'database', ip: '192.168.1.101:9092',status: 'active',   connections: 8,   traffic: 4100  },
    { id: 'grafana',      label: 'Grafana',           type: 'server',   ip: '192.168.1.101:3000',status: 'active',   connections: 3,   traffic: 320   },
    { id: 'attacker1',    label: 'External Attacker', type: 'attacker', ip: '185.220.101.42',    status: 'critical', connections: 847, traffic: 45000 },
    { id: 'attacker2',    label: 'Brute Force Bot',   type: 'attacker', ip: '101.36.100.25',     status: 'critical', connections: 623, traffic: 32000 },
    { id: 'dns',          label: 'DNS Server',        type: 'external', ip: '8.8.8.8',           status: 'active',   connections: 200, traffic: 1500  },
    { id: 'ollama',       label: 'AI/LLM (Groq)',     type: 'external', ip: 'api.groq.com',      status: 'active',   connections: 2,   traffic: 50    },
  ];
  const edges: TopoEdge[] = [
    { source: 'pfsense', target: 'ubuntu',        protocol: 'TCP',    packets: 8400,  status: 'normal',     label: 'LAN' },
    { source: 'pfsense', target: 'windows',       protocol: 'TCP',    packets: 720,   status: 'normal',     label: 'LAN' },
    { source: 'windows', target: 'ubuntu',        protocol: 'HTTP',   packets: 320,   status: 'normal',     label: 'API' },
    { source: 'ubuntu',  target: 'elasticsearch', protocol: 'HTTP',   packets: 5600,  status: 'normal',     label: '9200' },
    { source: 'ubuntu',  target: 'kafka',         protocol: 'TCP',    packets: 4100,  status: 'normal',     label: '9092' },
    { source: 'ubuntu',  target: 'grafana',       protocol: 'HTTP',   packets: 320,   status: 'normal',     label: '3000' },
    { source: 'ubuntu',  target: 'ollama',        protocol: 'HTTPS',  packets: 50,    status: 'normal',     label: 'AI' },
    { source: 'kali',    target: 'pfsense',       protocol: 'TCP/UDP',packets: 3200,  status: 'suspicious', label: 'Attack Sim' },
    { source: 'attacker1',target:'pfsense',       protocol: 'TCP',    packets: 45000, status: 'malicious',  label: 'SSH Brute' },
    { source: 'attacker2',target:'pfsense',       protocol: 'TCP',    packets: 32000, status: 'malicious',  label: 'Port Scan' },
    { source: 'pfsense', target: 'dns',           protocol: 'UDP',    packets: 1500,  status: 'normal',     label: 'DNS' },
    { source: 'kafka',   target: 'elasticsearch', protocol: 'HTTP',   packets: 2800,  status: 'normal',     label: 'Connector' },
  ];
  return {
    nodes, edges,
    stats: {
      totalNodes: nodes.length,
      totalConnections: edges.length,
      anomalousConnections: edges.filter(e => e.status !== 'normal').length,
      activeFlows: edges.reduce((s, e) => s + (e.packets || 0), 0),
    },
  };
}

function buildTopoElements(data: TopoData): { nodes: Node[]; edges: Edge[] } {
  const cx = 500, cy = 350;
  const positions: Record<string, { x: number; y: number }> = {
    pfsense: { x: cx, y: cy }, ubuntu: { x: cx + 250, y: cy - 80 },
    windows: { x: cx - 250, y: cy - 80 }, elasticsearch: { x: cx + 400, y: cy - 200 },
    kafka: { x: cx + 400, y: cy + 40 }, grafana: { x: cx + 250, y: cy - 250 },
    kali: { x: cx - 200, y: cy + 200 }, attacker1: { x: cx - 350, y: cy - 200 },
    attacker2: { x: cx - 350, y: cy + 80 }, dns: { x: cx + 100, y: cy + 250 },
    ollama: { x: cx + 350, y: cy + 200 },
  };
  const flowNodes: Node[] = data.nodes.map(n => ({
    id: n.id, type: 'custom',
    position: positions[n.id] || { x: Math.random() * 800 + 100, y: Math.random() * 500 + 100 },
    data: n, sourcePosition: Position.Right, targetPosition: Position.Left,
  }));
  const flowEdges: Edge[] = data.edges.map((e, i) => ({
    id: `e-${i}`, source: e.source, target: e.target,
    animated: e.status !== 'normal',
    style: { stroke: EDGE_COLORS[e.status] || '#334155', strokeWidth: e.status === 'malicious' ? 2.5 : 1.5 },
    label: e.label,
    labelStyle: { fill: '#94a3b8', fontSize: 10 },
    labelBgStyle: { fill: '#0c1629', fillOpacity: 0.85 },
    labelBgPadding: [4, 6] as [number, number],
    markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS[e.status] || '#334155' },
  }));
  return { nodes: flowNodes, edges: flowEdges };
}

// ── Node detail panel ──────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  wan: Globe, firewall: Shield, switch: Network,
  server: Server, device: Monitor, client: Laptop,
  attacker: Skull, database: Database, external: Globe,
};

function NodeDetailPanel({ node, onClose }: { node: NodeDetail; onClose: () => void }) {
  const Icon = TYPE_ICON[node.type] ?? Monitor;
  const statusColor = STATUS_COLORS[node.status] ?? '#6b7280';

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ background: 'var(--glass-bg)', borderColor: node.color + '55', backdropFilter: 'blur(12px)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
            style={{ background: node.color + '20', border: `1px solid ${node.color}55` }}>
            <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18, color: node.color }} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{node.label}</p>
            <p className="text-xs text-muted-foreground">{node.role}</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close node details"
          className="rounded p-1 hover:bg-muted transition-colors shrink-0">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5 py-0.5">
        <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: statusColor }} />
        <span className="text-xs font-medium capitalize" style={{ color: statusColor }}>{node.status}</span>
      </div>

      {/* Details */}
      <div className="space-y-2 text-xs border-t border-border pt-3">
        {[
          { label: 'IP Address', value: node.ip, mono: true },
          { label: 'Node Type',  value: node.type.charAt(0).toUpperCase() + node.type.slice(1) },
          { label: 'Connections', value: node.connections.toString() },
          { label: 'Traffic', value: node.traffic.toLocaleString() + ' pkts' },
        ].map(({ label, value, mono }) => (
          <div key={label} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{label}</span>
            <span className={`text-foreground font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Description */}
      <p className="text-[11px] text-muted-foreground border-t border-border pt-2.5 leading-relaxed">
        {node.description}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type ViewMode = 'flow' | 'topology';

export function NetworkFlowPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('flow');
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
  const [liveData, setLiveData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<TrafficStat[]>([]);
  const [totalPackets, setTotalPackets] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);

  // Topology state
  const [topoData] = useState<TopoData>(generateTopoData);
  const { nodes: topoNodes, edges: topoEdges } = useMemo(() => buildTopoElements(topoData), [topoData]);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef    = useRef<number>(0);
  const packetsRef = useRef<Packet[]>([]);
  const rotYRef    = useRef(0.35);
  const isDragging = useRef(false);
  const lastMouseX = useRef(0);
  const nextId     = useRef(0);
  // Projected positions for click detection
  const projectedRef = useRef(new Map<string, { sx: number; sy: number; scale: number }>());
  // Ref mirror of selectedNode.id so the render loop reads it without restarting
  const selectedNodeIdRef = useRef<string | null>(null);

  const fetchLiveData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/logs/recent`, { signal: AbortSignal.timeout(2000) });
      setLiveData(res.ok);
    } catch { setLiveData(false); }
    setIsRefreshing(false);
  }, []);

  useEffect(() => { fetchLiveData(); }, [fetchLiveData]);

  // Keep the ref in sync so the canvas render loop can read it without restarting
  useEffect(() => { selectedNodeIdRef.current = selectedNode?.id ?? null; }, [selectedNode]);

  const spawnPacket = useCallback(() => {
    const edge = FLOW_EDGES[Math.floor(Math.random() * FLOW_EDGES.length)];
    if (!edge) return;
    const type = weightedRandom();
    const [from, to] = Math.random() > 0.3 ? [edge.from, edge.to] : [edge.to, edge.from];
    packetsRef.current.push({ id: nextId.current++, fromId: from, toId: to, progress: 0, speed: 0.004 + Math.random() * 0.006, color: type.color, label: type.label, size: type.label === 'BLOCKED' ? 5 : 3.5 });
    if (packetsRef.current.length > 80) packetsRef.current.shift();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewMode !== 'flow') return;
    const nodeMap = new Map(FLOW_NODES.map(n => [n.id, n]));
    const typeCounts: Record<string, number> = {};
    let total = 0, blocked = 0;
    const spawnInterval = setInterval(() => { if (Math.random() < 0.7) spawnPacket(); }, 120);

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2, fov = 520, rot = rotYRef.current;

      ctx.clearRect(0, 0, W, H);

      // Dark canvas background
      ctx.fillStyle = '#070c18';
      ctx.fillRect(0, 0, W, H);

      // Subtle grid
      ctx.strokeStyle = 'rgba(0,217,255,0.04)';
      ctx.lineWidth = 1;
      const gs = 50;
      for (let gx = cx % gs; gx < W; gx += gs) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = cy % gs; gy < H; gy += gs) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      // Project all nodes
      const projected = new Map<string, { sx: number; sy: number; scale: number }>();
      for (const n of FLOW_NODES) {
        projected.set(n.id, project(n.x, n.y, n.z, rot, cx, cy, fov));
      }
      projectedRef.current = projected;

      // Draw edges
      for (const edge of FLOW_EDGES) {
        const a = projected.get(edge.from)!, b = projected.get(edge.to)!;
        const grad = ctx.createLinearGradient(a.sx, a.sy, b.sx, b.sy);
        grad.addColorStop(0, 'rgba(0,217,255,0.25)');
        grad.addColorStop(1, 'rgba(0,217,255,0.08)');
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
        ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.stroke();
      }

      // Draw nodes (back-to-front)
      const sorted = [...FLOW_NODES].sort((a, b) => {
        const az = a.x * Math.sin(rot) + a.z * Math.cos(rot);
        const bz = b.x * Math.sin(rot) + b.z * Math.cos(rot);
        return az - bz;
      });

      for (const node of sorted) {
        const { sx, sy, scale } = projected.get(node.id)!;
        const r = node.radius * scale;
        const isSelected = selectedNodeIdRef.current === node.id;

        // Outer glow
        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * (isSelected ? 3.5 : 2.5));
        grd.addColorStop(0, node.glowColor.replace('0.4', isSelected ? '0.7' : '0.4'));
        grd.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(sx, sy, r * (isSelected ? 3.5 : 2.5), 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.fill();

        // Selection ring
        if (isSelected) {
          ctx.beginPath(); ctx.arc(sx, sy, r + 6 * scale, 0, Math.PI * 2);
          ctx.strokeStyle = node.color; ctx.lineWidth = 2 * scale; ctx.setLineDash([4 * scale, 4 * scale]);
          ctx.stroke(); ctx.setLineDash([]);
        }

        // Node circle
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = node.color + '28'; ctx.fill();
        ctx.strokeStyle = node.color; ctx.lineWidth = 2 * scale; ctx.stroke();

        // Inner dot
        ctx.beginPath(); ctx.arc(sx, sy, r * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = node.color; ctx.fill();

        // Label pill — always visible
        const labelText = node.label;
        const ipText = node.ip;
        const fontSize = Math.max(10, Math.round(11 * scale));
        const ipSize = Math.max(8, Math.round(9 * scale));
        const pillY = sy + r + 8 * scale;
        const pillPadX = 8 * scale;
        const pillH = (fontSize + ipSize + 8) * scale;

        ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
        const lw = ctx.measureText(labelText).width;
        ctx.font = `${ipSize}px "SF Mono", monospace`;
        const iw = ctx.measureText(ipText).width;
        const pillW = Math.max(lw, iw) + pillPadX * 2;

        // Pill background
        const px = sx - pillW / 2;
        ctx.fillStyle = 'rgba(7,12,24,0.88)';
        ctx.beginPath();
        ctx.roundRect(px, pillY, pillW, pillH, 4 * scale);
        ctx.fill();
        ctx.strokeStyle = node.color + '44';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label text
        ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#e4e7eb';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, sx, pillY + fontSize + 2 * scale);

        // IP text
        ctx.font = `${ipSize}px "SF Mono", monospace`;
        ctx.fillStyle = node.color + 'cc';
        ctx.fillText(ipText, sx, pillY + fontSize + ipSize + 5 * scale);
      }

      // Update + draw packets
      packetsRef.current = packetsRef.current.filter(p => {
        p.progress += p.speed;
        if (p.progress >= 1) {
          typeCounts[p.label] = (typeCounts[p.label] || 0) + 1;
          total++; if (p.label === 'BLOCKED') blocked++;
          return false;
        }
        const fn = nodeMap.get(p.fromId)!, tn = nodeMap.get(p.toId)!;
        const pf = projected.get(p.fromId)!, pt = projected.get(p.toId)!;
        const px = pf.sx + (pt.sx - pf.sx) * p.progress;
        const py = pf.sy + (pt.sy - pf.sy) * p.progress;
        const sc = pf.scale + (pt.scale - pf.scale) * p.progress;
        const sz = p.size * sc;

        // Trail
        const steps = 4;
        for (let i = steps; i >= 1; i--) {
          const tp = Math.max(0, p.progress - i * 0.015);
          const tsx = pf.sx + (pt.sx - pf.sx) * tp;
          const tsy = pf.sy + (pt.sy - pf.sy) * tp;
          const alpha = (1 - i / steps) * 0.35;
          ctx.beginPath(); ctx.arc(tsx, tsy, sz * (1 - i * 0.15), 0, Math.PI * 2);
          ctx.fillStyle = p.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
          ctx.fill();
        }

        // Packet glow
        const pg = ctx.createRadialGradient(px, py, 0, px, py, sz * 3);
        pg.addColorStop(0, p.color + 'cc'); pg.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(px, py, sz * 3, 0, Math.PI * 2);
        ctx.fillStyle = pg; ctx.fill();

        // Packet dot
        ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.fill();

        // Suppress unused var warning
        void fn; void tn;
        return true;
      });

      rotYRef.current += 0.0006;
      animRef.current = requestAnimationFrame(render);
    };

    render();
    const statsInterval = setInterval(() => {
      const entries = Object.entries(typeCounts).map(([label, count]) => ({
        label, count, color: PACKET_TYPES.find(t => t.label === label)?.color || '#fff',
      })).sort((a, b) => b.count - a.count);
      setStats(entries);
      setTotalPackets(total);
      setBlockedCount(blocked);
    }, 1500);

    return () => { cancelAnimationFrame(animRef.current); clearInterval(spawnInterval); clearInterval(statsInterval); };
  }, [spawnPacket, viewMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewMode !== 'flow') return;
    const ro = new ResizeObserver(() => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, [viewMode]);

  // Click detection on canvas
  const onCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    for (const node of FLOW_NODES) {
      const p = projectedRef.current.get(node.id);
      if (!p) continue;
      const r = node.radius * p.scale + 10;
      if (Math.hypot(mx - p.sx, my - p.sy) <= r) {
        setSelectedNode(node);
        return;
      }
    }
    setSelectedNode(null);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => { isDragging.current = false; lastMouseX.current = e.clientX; };
  const onMouseMove = (e: React.MouseEvent) => {
    if (e.buttons !== 1) return;
    const delta = Math.abs(e.clientX - lastMouseX.current);
    if (delta > 3) isDragging.current = true;
    rotYRef.current += (e.clientX - lastMouseX.current) * 0.005;
    lastMouseX.current = e.clientX;
  };
  const onMouseUp = () => { setTimeout(() => { isDragging.current = false; }, 50); };

  // Topology node click
  const onTopoNodeClick = useCallback((_: unknown, node: Node) => {
    const d = node.data as TopoNode;
    setSelectedNode({
      id: d.id, label: d.label, ip: d.ip, type: d.type,
      color: NODE_STYLE[d.type]?.border ?? '#6b7280',
      glowColor: NODE_STYLE[d.type]?.glow ?? '',
      description: `${d.type.charAt(0).toUpperCase() + d.type.slice(1)} node in the network`,
      status: d.status, connections: d.connections, traffic: d.traffic ?? 0,
      role: d.type.charAt(0).toUpperCase() + d.type.slice(1),
    });
  }, []);

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-9.5rem)]">
      {/* Header row */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Network</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {viewMode === 'flow'
              ? 'Live 3D packet traffic visualization — click a node for details'
              : 'Interactive infrastructure dependency map — click a node for details'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View tabs */}
          <div className="flex rounded-lg border border-border overflow-hidden" style={{ background: 'var(--glass-bg)' }}>
            {([['flow', 'Packet Flow', Waypoints], ['topology', 'Topology', Network]] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setViewMode(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          {viewMode === 'flow' && (
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${liveData ? 'border-success/30 bg-success/5 text-success' : 'border-warning/30 bg-warning/5 text-warning'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${liveData ? 'bg-success animate-pulse' : 'bg-warning'}`} />
              {liveData ? 'Live Data' : 'Simulated'}
            </div>
          )}
          <button onClick={fetchLiveData} disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Refresh">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {viewMode === 'topology' ? 'Refresh' : 'Reconnect'}
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_272px] gap-4 flex-1 min-h-0">
        {/* Canvas / ReactFlow */}
        <div className="rounded-xl border border-border overflow-hidden min-h-0"
          style={{ background: viewMode === 'flow' ? '#070c18' : '#060a14' }}>
          {viewMode === 'flow' ? (
            <canvas ref={canvasRef} className="w-full h-full cursor-crosshair"
              onClick={onCanvasClick} onMouseDown={onMouseDown}
              onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
              aria-label="3D network packet flow — click node for details, drag to rotate" />
          ) : (
            <>
              <style>{`
                .react-flow__minimap { background: #0c1629 !important; border: 1px solid #1e293b !important; border-radius: 8px !important; }
                .react-flow__controls { background: #0c1629 !important; border: 1px solid #1e293b !important; border-radius: 8px !important; }
                .react-flow__controls-button { background: #0c1629 !important; border-bottom: 1px solid #1e293b !important; fill: #94a3b8 !important; }
                .react-flow__controls-button:hover { background: #1e293b !important; }
                .react-flow__attribution { display: none !important; }
              `}</style>
              <ReactFlow nodes={topoNodes} edges={topoEdges} nodeTypes={topoNodeTypes}
                fitView minZoom={0.3} maxZoom={2}
                onNodeClick={onTopoNodeClick} proOptions={{ hideAttribution: true }}>
                <Background color="#1e293b" gap={25} size={1} />
                <Controls position="bottom-left" />
                <MiniMap nodeColor={n => NODE_STYLE[(n.data as TopoNode).type]?.border ?? '#6b7280'} maskColor="rgba(6,10,20,0.85)" />
              </ReactFlow>
            </>
          )}
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-3 overflow-y-auto min-h-0">
          {/* Selected node detail */}
          {selectedNode && (
            <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
          )}

          {viewMode === 'flow' ? (
            <>
              {/* Traffic stats */}
              <div className="rounded-xl border border-border p-4 shrink-0"
                style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="text-sm font-semibold text-foreground">Live Traffic</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-lg bg-muted/40 p-2.5 text-center">
                    <p className="text-xl font-bold text-foreground tabular-nums">{totalPackets.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="rounded-lg bg-destructive/10 p-2.5 text-center">
                    <p className="text-xl font-bold text-destructive tabular-nums">{blockedCount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Blocked</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {stats.slice(0, 6).map(s => (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-xs text-muted-foreground flex-1">{s.label}</span>
                      <span className="text-xs font-mono font-semibold text-foreground tabular-nums">{s.count.toLocaleString()}</span>
                    </div>
                  ))}
                  {stats.length === 0 && <p className="text-xs text-muted-foreground text-center py-1">Collecting…</p>}
                </div>
              </div>

              {/* Node list */}
              <div className="rounded-xl border border-border p-4"
                style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Nodes — click to inspect
                </p>
                <div className="space-y-1.5">
                  {FLOW_NODES.map(node => {
                    const Icon = TYPE_ICON[node.type] ?? Monitor;
                    const isSelected = selectedNode?.id === node.id;
                    return (
                      <button key={node.id} onClick={() => setSelectedNode(isSelected ? null : node)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/60'}`}
                        style={{ border: isSelected ? `1px solid ${node.color}55` : '1px solid transparent' }}>
                        <div className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                          style={{ background: node.color + '20', border: `1px solid ${node.color}44` }}>
                          <Icon className="h-3 w-3" style={{ color: node.color }} aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-xs font-medium text-foreground truncate">{node.label}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{node.ip}</p>
                        </div>
                        <div className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ background: STATUS_COLORS[node.status] }} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Packet types */}
              <div className="rounded-xl border border-border p-4 shrink-0"
                style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Packet Types
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PACKET_TYPES.map(t => (
                    <div key={t.label} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: t.color }} />
                      <span className="text-xs text-muted-foreground">{t.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-3">Drag canvas to rotate</p>
              </div>
            </>
          ) : (
            <>
              {/* Topology stats */}
              <div className="grid grid-cols-2 gap-2 shrink-0">
                {[
                  { label: 'Nodes', value: topoData.stats.totalNodes, color: 'text-indigo-400', icon: Radio },
                  { label: 'Connections', value: topoData.stats.totalConnections, color: 'text-primary', icon: Activity },
                  { label: 'Anomalous', value: topoData.stats.anomalousConnections, color: 'text-orange-400', icon: AlertTriangle },
                  { label: 'Active Flows', value: topoData.stats.activeFlows.toLocaleString(), color: 'text-green-400', icon: Zap },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="rounded-xl border border-border p-3"
                    style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={`h-3.5 w-3.5 ${color}`} aria-hidden="true" />
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                    </div>
                    <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="rounded-xl border border-border p-4"
                style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Node Types
                </p>
                <div className="space-y-1.5">
                  {Object.entries(NODE_STYLE).map(([type, style]) => (
                    <div key={type} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded border shrink-0" style={{ borderColor: style.border, background: style.bg }} />
                      <span className="text-xs capitalize text-muted-foreground">{type}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Edge legend */}
              <div className="rounded-xl border border-border p-4"
                style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Connection Status
                </p>
                <div className="space-y-1.5">
                  {Object.entries(EDGE_COLORS).map(([status, color]) => (
                    <div key={status} className="flex items-center gap-2">
                      <div className="h-0.5 w-5 rounded shrink-0" style={{ background: color }} />
                      <span className="text-xs capitalize text-muted-foreground">{status}</span>
                      {status !== 'normal' && <span className="text-[10px] text-muted-foreground/60 italic">(animated)</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
