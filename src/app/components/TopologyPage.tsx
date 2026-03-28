import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    type Node,
    type Edge,
    Position,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    Network, Shield, Server, Skull,
    RefreshCw, Loader2, Activity, Zap, AlertTriangle,
    Laptop, Database, Globe, Radio, Monitor
} from 'lucide-react';
import { BACKEND_URL } from '@/lib/api';
import { NodeDetailCard, type NodeDetail } from './ui/NodeDetailCard';

// ─── Types ──────────────────────────────────────────────────────
interface TopologyData {
    nodes: TopologyNode[];
    edges: TopologyEdge[];
    stats: {
        totalNodes: number;
        totalConnections: number;
        anomalousConnections: number;
        activeFlows: number;
    };
}

interface TopologyNode {
    id: string;
    label: string;
    type: 'firewall' | 'server' | 'attacker' | 'client' | 'database' | 'external';
    ip: string;
    status: 'active' | 'warning' | 'critical' | 'offline';
    connections: number;
    traffic?: number;
    [key: string]: unknown;
}

interface TopologyEdge {
    source: string;
    target: string;
    protocol?: string;
    packets?: number;
    status: 'normal' | 'suspicious' | 'malicious';
    label?: string;
}

// ─── Node Colors ────────────────────────────────────────────────
const NODE_STYLE: Record<string, { bg: string; border: string; icon: string; glow: string }> = {
    firewall: { bg: '#0c1629', border: '#00d9ff', icon: '#00d9ff', glow: '0 0 15px rgba(0,217,255,0.3)' },
    server: { bg: '#0c1629', border: '#6366f1', icon: '#818cf8', glow: '0 0 15px rgba(99,102,241,0.3)' },
    attacker: { bg: '#1a0a0a', border: '#ef4444', icon: '#f87171', glow: '0 0 15px rgba(239,68,68,0.3)' },
    client: { bg: '#0c1629', border: '#22c55e', icon: '#4ade80', glow: '0 0 15px rgba(34,197,94,0.3)' },
    database: { bg: '#0c1629', border: '#f59e0b', icon: '#fbbf24', glow: '0 0 15px rgba(245,158,11,0.3)' },
    external: { bg: '#0c1629', border: '#8b5cf6', icon: '#a78bfa', glow: '0 0 15px rgba(139,92,246,0.3)' },
};

const STATUS_COLORS: Record<string, string> = {
    active: '#22c55e',
    warning: '#f59e0b',
    critical: '#ef4444',
    offline: '#6b7280',
};

const EDGE_COLORS: Record<string, string> = {
    normal: '#334155',
    suspicious: '#f59e0b',
    malicious: '#ef4444',
};

// ─── Custom Node Component ──────────────────────────────────────
function getNodeIcon(type: string, color: string) {
    const props = { className: 'h-5 w-5', style: { color } };
    switch (type) {
        case 'firewall': return <Shield {...props} />;
        case 'server': return <Server {...props} />;
        case 'attacker': return <Skull {...props} />;
        case 'client': return <Laptop {...props} />;
        case 'database': return <Database {...props} />;
        case 'external': return <Globe {...props} />;
        default: return <Monitor {...props} />;
    }
}

function CustomNode({ data }: { data: TopologyNode & { selected?: boolean } }) {
    const style = NODE_STYLE[data.type] || NODE_STYLE.external;
    const statusColor = STATUS_COLORS[data.status] || '#6b7280';

    return (
        <div
            className="rounded-xl border-2 px-4 py-3 min-w-[140px] transition-all"
            style={{
                background: style?.bg ?? '#0c1629',
                borderColor: style?.border ?? '#334155',
                boxShadow: style?.glow ?? 'none',
            }}
        >
            <div className="flex items-center gap-2 mb-1.5">
                {getNodeIcon(data.type, style?.icon ?? '#94a3b8')}
                <span className="text-xs font-semibold text-foreground truncate">{data.label}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-mono">{data.ip}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} />
                    <span className="text-[10px] capitalize" style={{ color: statusColor }}>{data.status}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{data.connections} conn</span>
            </div>
        </div>
    );
}

const nodeTypes = { custom: CustomNode };

// ─── Mock Topology ──────────────────────────────────────────────
function generateMockTopology(): TopologyData {
    const nodes: TopologyNode[] = [
        { id: 'pfsense', label: 'pfSense Firewall', type: 'firewall', ip: '192.168.1.1', status: 'active', connections: 42, traffic: 12500 },
        { id: 'ubuntu', label: 'Ubuntu Server', type: 'server', ip: '192.168.1.101', status: 'active', connections: 28, traffic: 8400 },
        { id: 'windows', label: 'Windows (Dashboard)', type: 'client', ip: '192.168.1.100', status: 'active', connections: 5, traffic: 720 },
        { id: 'kali', label: 'Kali Linux', type: 'attacker', ip: '192.168.1.103', status: 'warning', connections: 15, traffic: 3200 },
        { id: 'elasticsearch', label: 'Elasticsearch', type: 'database', ip: '192.168.1.101:9200', status: 'active', connections: 12, traffic: 5600 },
        { id: 'kafka', label: 'Kafka Broker', type: 'database', ip: '192.168.1.101:9092', status: 'active', connections: 8, traffic: 4100 },
        { id: 'grafana', label: 'Grafana', type: 'server', ip: '192.168.1.101:3000', status: 'active', connections: 3, traffic: 320 },
        { id: 'attacker1', label: 'External Attacker', type: 'attacker', ip: '185.220.101.42', status: 'critical', connections: 847, traffic: 45000 },
        { id: 'attacker2', label: 'Brute Force Bot', type: 'attacker', ip: '101.36.100.25', status: 'critical', connections: 623, traffic: 32000 },
        { id: 'dns', label: 'DNS Server', type: 'external', ip: '8.8.8.8', status: 'active', connections: 200, traffic: 1500 },
        { id: 'ollama', label: 'AI/LLM (Groq)', type: 'external', ip: 'api.groq.com', status: 'active', connections: 2, traffic: 50 },
    ];

    const edges: TopologyEdge[] = [
        { source: 'pfsense', target: 'ubuntu', protocol: 'TCP', packets: 8400, status: 'normal', label: 'LAN' },
        { source: 'pfsense', target: 'windows', protocol: 'TCP', packets: 720, status: 'normal', label: 'LAN' },
        { source: 'windows', target: 'ubuntu', protocol: 'HTTP', packets: 320, status: 'normal', label: 'API' },
        { source: 'ubuntu', target: 'elasticsearch', protocol: 'HTTP', packets: 5600, status: 'normal', label: '9200' },
        { source: 'ubuntu', target: 'kafka', protocol: 'TCP', packets: 4100, status: 'normal', label: '9092' },
        { source: 'ubuntu', target: 'grafana', protocol: 'HTTP', packets: 320, status: 'normal', label: '3000' },
        { source: 'ubuntu', target: 'ollama', protocol: 'HTTPS', packets: 50, status: 'normal', label: 'AI' },
        { source: 'kali', target: 'pfsense', protocol: 'TCP/UDP', packets: 3200, status: 'suspicious', label: 'Attack Sim' },
        { source: 'attacker1', target: 'pfsense', protocol: 'TCP', packets: 45000, status: 'malicious', label: 'SSH Brute Force' },
        { source: 'attacker2', target: 'pfsense', protocol: 'TCP', packets: 32000, status: 'malicious', label: 'Port Scan' },
        { source: 'pfsense', target: 'dns', protocol: 'UDP', packets: 1500, status: 'normal', label: 'DNS' },
        { source: 'kafka', target: 'elasticsearch', protocol: 'HTTP', packets: 2800, status: 'normal', label: 'Connector' },
    ];

    return {
        nodes,
        edges,
        stats: {
            totalNodes: nodes.length,
            totalConnections: edges.length,
            anomalousConnections: edges.filter(e => e.status !== 'normal').length,
            activeFlows: edges.reduce((sum, e) => sum + (e.packets || 0), 0),
        },
    };
}

// ─── Layout Helpers ─────────────────────────────────────────────
function buildReactFlowElements(data: TopologyData): { nodes: Node[]; edges: Edge[] } {
    // Position nodes in a radial layout around the firewall
    const centerX = 500;
    const centerY = 350;

    const positions: Record<string, { x: number; y: number }> = {
        pfsense: { x: centerX, y: centerY },
        ubuntu: { x: centerX + 250, y: centerY - 80 },
        windows: { x: centerX - 250, y: centerY - 80 },
        elasticsearch: { x: centerX + 400, y: centerY - 200 },
        kafka: { x: centerX + 400, y: centerY + 40 },
        grafana: { x: centerX + 250, y: centerY - 250 },
        kali: { x: centerX - 200, y: centerY + 200 },
        attacker1: { x: centerX - 350, y: centerY - 200 },
        attacker2: { x: centerX - 350, y: centerY + 80 },
        dns: { x: centerX + 100, y: centerY + 250 },
        ollama: { x: centerX + 350, y: centerY + 200 },
    };

    const flowNodes: Node[] = data.nodes.map((n) => ({
        id: n.id,
        type: 'custom',
        position: positions[n.id] || { x: Math.random() * 800 + 100, y: Math.random() * 500 + 100 },
        data: n,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
    }));

    const flowEdges: Edge[] = data.edges.map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        animated: e.status !== 'normal',
        style: {
            stroke: EDGE_COLORS[e.status] || '#334155',
            strokeWidth: e.status === 'malicious' ? 2.5 : 1.5,
        },
        label: e.label,
        labelStyle: { fill: '#94a3b8', fontSize: 10 },
        labelBgStyle: { fill: '#0c1629', fillOpacity: 0.8 },
        labelBgPadding: [4, 6] as [number, number],
        markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS[e.status] || '#334155' },
    }));

    return { nodes: flowNodes, edges: flowEdges };
}

// ─── Component ──────────────────────────────────────────────────
export function TopologyPage() {
    const [topoData, setTopoData] = useState<TopologyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);

    const fetchTopology = useCallback(async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/topology`);
            if (response.ok) {
                const data = await response.json();
                setTopoData(data);
            } else {
                setTopoData(generateMockTopology());
            }
        } catch {
            setTopoData(generateMockTopology());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTopology();
        const interval = setInterval(fetchTopology, 30000);
        return () => clearInterval(interval);
    }, [fetchTopology]);

    const { nodes: flowNodes, edges: flowEdges } = useMemo(
        () => topoData ? buildReactFlowElements(topoData) : { nodes: [], edges: [] },
        [topoData]
    );

    if (loading || !topoData) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                        <Network className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">Network Topology</h1>
                        <p className="text-sm text-muted-foreground">Interactive infrastructure dependency map</p>
                    </div>
                </div>
                <button
                    onClick={fetchTopology}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Radio className="h-4 w-4 text-indigo-400" />
                        <span className="text-xs text-muted-foreground">Total Nodes</span>
                    </div>
                    <p className="text-2xl font-bold text-indigo-400">{topoData.stats.totalNodes}</p>
                </div>
                <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Activity className="h-4 w-4 text-primary" />
                        <span className="text-xs text-muted-foreground">Connections</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">{topoData.stats.totalConnections}</p>
                </div>
                <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-orange-400" />
                        <span className="text-xs text-muted-foreground">Anomalous</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-400">{topoData.stats.anomalousConnections}</p>
                </div>
                <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-4 w-4 text-green-400" />
                        <span className="text-xs text-muted-foreground">Active Flows</span>
                    </div>
                    <p className="text-2xl font-bold text-green-400">{topoData.stats.activeFlows.toLocaleString()}</p>
                </div>
            </div>

            {/* Topology Graph */}
            <div className="grid grid-cols-[1fr_280px] gap-4">
                <div
                    className="rounded-lg border border-border overflow-hidden"
                    style={{ height: '600px', background: '#060a14' }}
                >
                    {/* Override React Flow CSS for dark theme */}
                    <style>{`
            .react-flow__minimap { background: #0c1629 !important; border: 1px solid #1e293b !important; border-radius: 8px !important; }
            .react-flow__controls { background: #0c1629 !important; border: 1px solid #1e293b !important; border-radius: 8px !important; }
            .react-flow__controls-button { background: #0c1629 !important; border-bottom: 1px solid #1e293b !important; fill: #94a3b8 !important; }
            .react-flow__controls-button:hover { background: #1e293b !important; }
            .react-flow__attribution { display: none !important; }
            .react-flow__edge-text { font-size: 10px; }
          `}</style>
                    <ReactFlow
                        nodes={flowNodes}
                        edges={flowEdges}
                        nodeTypes={nodeTypes}
                        fitView
                        minZoom={0.3}
                        maxZoom={2}
                        onNodeClick={(_event, node) => {
                            const d = node.data as unknown as TopologyNode;
                            setSelectedNode({
                                id: d.id, label: d.label, ip: d.ip, type: d.type,
                                color: NODE_STYLE[d.type]?.border ?? '#6b7280',
                                status: d.status, connections: d.connections, traffic: d.traffic,
                            });
                        }}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background color="#1e293b" gap={25} size={1} />
                        <Controls position="bottom-left" />
                        <MiniMap
                            nodeColor={(node) => {
                                const d = node.data as unknown as TopologyNode;
                                return NODE_STYLE[d.type]?.border || '#6b7280';
                            }}
                            maskColor="rgba(6,10,20,0.85)"
                        />
                    </ReactFlow>
                </div>

                {/* Sidebar — Node Details + Legend */}
                <div className="space-y-4">
                    {/* Node Legend */}
                    <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
                        <h3 className="text-sm font-medium mb-3">Node Types</h3>
                        <div className="space-y-2">
                            {Object.entries(NODE_STYLE).map(([type, style]) => (
                                <div key={type} className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-sm border" style={{ borderColor: style.border, background: style.bg }} />
                                    <span className="text-xs capitalize text-muted-foreground">{type}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Edge Legend */}
                    <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
                        <h3 className="text-sm font-medium mb-3">Connection Status</h3>
                        <div className="space-y-2">
                            {Object.entries(EDGE_COLORS).map(([status, color]) => (
                                <div key={status} className="flex items-center gap-2">
                                    <div className="h-0.5 w-6 rounded" style={{ background: color }} />
                                    <span className="text-xs capitalize text-muted-foreground">{status}</span>
                                    {status !== 'normal' && <span className="text-[10px] text-muted-foreground italic">(animated)</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Selected Node Detail */}
                    {selectedNode && (
                        <NodeDetailCard node={selectedNode} onDismiss={() => setSelectedNode(null)} />
                    )}
                </div>
            </div>
        </div>
    );
}
