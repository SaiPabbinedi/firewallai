import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Shield, Monitor, RefreshCw, Activity, Globe,
  Server, Network, Skull, Laptop, Database,
  Radio, AlertTriangle, Zap, X, Layers, Waypoints,
} from 'lucide-react';
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, Position, MarkerType,
  applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BACKEND_URL } from '@/lib/api';
import { NetworkTopologyDepth } from './ui/NetworkTopologyDepth';
import { motion } from 'framer-motion';

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
    { source: 'attacker1',target:'pfsense',       protocol: 'TCP',    packets: 45000, status: 'malicious',  label: 'DDoS' },
    { source: 'attacker2',target:'pfsense',       protocol: 'TCP',    packets: 32000, status: 'malicious',  label: 'Brute Force' },
    { source: 'pfsense', target: 'dns',           protocol: 'UDP',    packets: 1500,  status: 'normal',     label: 'DNS' },
  ];
  return {
    nodes, edges,
    stats: { totalNodes: nodes.length, totalConnections: edges.length, anomalousConnections: 3, activeFlows: 12450 },
  };
}

export function NetworkFlowPage() {
  const [view, setView] = useState<'3d' | 'topology' | 'depth'>('3d');
  const [rotation, setRotation] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [topoData, setTopoData] = useState<TopoData>(generateTopoData());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ReactFlow state for interactivity
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const packetsRef = useRef<Packet[]>([]);
  const selectedNodeIdRef = useRef<string | null>(null);
  const projectedRef = useRef<Map<string, { sx: number; sy: number; scale: number }>>(new Map());

  const nodeMap = useMemo(() => new Map(FLOW_NODES.map(n => [n.id, n])), []);
  
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    
    // Check FLOW_NODES first (for 3D view)
    const flowNode = FLOW_NODES.find(n => n.id === selectedNodeId);
    if (flowNode) return flowNode;
    
    // Then check topoData (for Topology view)
    const topoNode = topoData.nodes.find(n => n.id === selectedNodeId);
    if (topoNode) {
      return {
        id: topoNode.id,
        label: topoNode.label,
        ip: topoNode.ip,
        type: topoNode.type,
        color: NODE_STYLE[topoNode.type]?.border || '#334155',
        glowColor: NODE_STYLE[topoNode.type]?.glow || 'rgba(51,65,85,0.3)',
        description: `Network node of type ${topoNode.type}. Currently ${topoNode.status} with ${topoNode.connections} active connections.`,
        status: topoNode.status,
        connections: topoNode.connections,
        traffic: topoNode.traffic || 0,
        role: topoNode.type.charAt(0).toUpperCase() + topoNode.type.slice(1),
      } as NodeDetail;
    }
    return null;
  }, [selectedNodeId, topoData]);

  const refreshTopo = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      const newData = generateTopoData();
      setTopoData(newData);
      setIsRefreshing(false);
    }, 800);
  }, []);

  // Initialize ReactFlow nodes and edges when topoData changes
  useEffect(() => {
    setRfNodes(topoData.nodes.map((n, i) => ({
      id: n.id,
      type: 'custom',
      data: n,
      position: { x: 100 + (i % 4) * 250, y: 100 + Math.floor(i / 4) * 180 },
    })));
    setRfEdges(topoData.edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: e.status !== 'normal',
      style: { stroke: EDGE_COLORS[e.status], strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS[e.status] },
    })));
  }, [topoData]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setRfNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setRfEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || view !== '3d') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let lastTime = performance.now();
    let total = 0, blocked = 0;
    const typeCounts: Record<string, number> = {};

    const render = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;
      setRotation(r => (r + dt * 0.00015) % (Math.PI * 2));
      const rot = rotation;

      const w = canvas.width, h = canvas.height;
      const cx = w / 2, cy = h / 2, fov = 400;

      ctx.clearRect(0, 0, w, h);

      // Spawn packets
      if (Math.random() < 0.18) {
        const edge = FLOW_EDGES[Math.floor(Math.random() * FLOW_EDGES.length)]!;
        const type = weightedRandom();
        packetsRef.current.push({
          id: Math.random(),
          fromId: edge.from, toId: edge.to,
          progress: 0, speed: 0.004 + Math.random() * 0.008,
          color: type.color, label: type.label, size: 2 + Math.random() * 2,
        });
      }

      // Project nodes
      const projected = new Map<string, { sx: number; sy: number; scale: number }>();
      for (const node of FLOW_NODES) {
        projected.set(node.id, project(node.x, node.y, node.z, rot, cx, cy, fov));
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

        // Label pill
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

        const px = sx - pillW / 2;
        ctx.fillStyle = 'rgba(7,12,24,0.88)';
        ctx.beginPath();
        ctx.roundRect(px, pillY, pillW, pillH, 4 * scale);
        ctx.fill();
        ctx.strokeStyle = node.color + '44';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#e4e7eb';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, sx, pillY + fontSize + 2 * scale);

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
        return true;
      });

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [view, rotation]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (view !== '3d') return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    let closestId: string | null = null, minDist = 40;
    projectedRef.current.forEach((p, id) => {
      const d = Math.hypot(p.sx - mx, p.sy - my);
      if (d < minDist) { minDist = d; closestId = id; }
    });
    setSelectedNodeId(closestId);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0"
        style={{ background: 'rgba(7,12,24,0.4)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Network className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Network Flow</h1>
            <p className="text-xs text-muted-foreground">Real-time packet visualization & topology</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted/50 p-1 rounded-lg border border-border mr-2">
            <button onClick={() => setView('3d')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${view === '3d' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Globe className="h-3.5 w-3.5" /> 3D Flow
            </button>
            <button onClick={() => setView('depth')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${view === 'depth' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Layers className="h-3.5 w-3.5" /> 3D Depth
            </button>
            <button onClick={() => setView('topology')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${view === 'topology' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Waypoints className="h-3.5 w-3.5" /> Topology
            </button>
          </div>
          <button onClick={refreshTopo} disabled={isRefreshing}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Canvas / Flow Area */}
        <div className="flex-1 relative bg-[#070c18]">
          {view === '3d' ? (
            <canvas ref={canvasRef} width={1200} height={800} onClick={handleCanvasClick}
              className="w-full h-full cursor-crosshair" />
          ) : view === 'depth' ? (
            <div className="w-full h-full p-8 overflow-auto custom-scrollbar">
              <NetworkTopologyDepth />
            </div>
          ) : (
            <div className="w-full h-full">
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={topoNodeTypes}
                fitView
              >
                <Background color="#1e293b" gap={20} />
                <Controls />
                <MiniMap nodeColor={n => NODE_STYLE[(n.data as TopoNode).type]?.border || '#334155'}
                  maskColor="rgba(15, 23, 42, 0.7)" style={{ background: '#0f172a' }} />
              </ReactFlow>
            </div>
          )}

          {/* Floating overlay for 3D and Topology view */}
          {selectedNode && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="absolute top-6 right-6 w-80 rounded-2xl border border-border p-5 shadow-2xl"
              style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(16px)', zIndex: 100 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ background: selectedNode.color + '20' }}>
                    <Shield className="h-5 w-5" style={{ color: selectedNode.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{selectedNode.label}</h3>
                    <p className="text-xs font-mono text-muted-foreground">{selectedNode.ip}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedNodeId(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">{selectedNode.description}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Status</p>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[selectedNode.status] }} />
                      <span className="text-xs font-semibold capitalize" style={{ color: STATUS_COLORS[selectedNode.status] }}>
                        {selectedNode.status}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Role</p>
                    <p className="text-xs font-semibold text-foreground">{selectedNode.role}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar Controls */}
        <div className="w-72 border-l border-border flex flex-col gap-4 p-4 overflow-y-auto custom-scrollbar shrink-0"
          style={{ background: 'rgba(7,12,24,0.2)' }}>
          {view === '3d' ? (
            <>
              {/* Node list */}
              <div className="rounded-xl border border-border p-4 shrink-0"
                style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Network Nodes
                </p>
                <div className="space-y-1">
                  {FLOW_NODES.map(node => {
                    const Icon = node.type === 'firewall' ? Shield : node.type === 'server' ? Server : Monitor;
                    return (
                      <button key={node.id} onClick={() => setSelectedNodeId(node.id)}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-lg transition-all ${selectedNodeId === node.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50 border border-transparent'}`}>
                        <div className="p-1.5 rounded shrink-0"
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
