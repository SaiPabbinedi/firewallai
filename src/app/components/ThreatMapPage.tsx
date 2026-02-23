import { useState, useEffect, useCallback, memo } from 'react';
import {
    ComposableMap,
    Geographies,
    Geography,
    Marker,
    Line,
} from 'react-simple-maps';
import {
    Globe, AlertTriangle, Shield, Activity, RefreshCw,
    Loader2, Crosshair, Clock, TrendingUp, Zap
} from 'lucide-react';
import { BACKEND_URL } from '@/lib/api';
import { getMitreTechnique, getMitreSeverityColor } from '@/lib/mitre';

// World TopoJSON — loaded client-side from CDN (zero server RAM)
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ─── Types ──────────────────────────────────────────────────────
interface GeoAttack {
    id: string;
    srcIp: string;
    lat: number;
    lng: number;
    country: string;
    countryCode: string;
    city?: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    classification?: string;
    count: number;
    lastSeen: string;
}

interface GeoStats {
    totalAttacks: number;
    uniqueCountries: number;
    topCountries: Array<{ country: string; code: string; count: number }>;
    severityBreakdown: { critical: number; high: number; medium: number; low: number };
    attacks: GeoAttack[];
}

// ─── Constants ──────────────────────────────────────────────────
const SEVERITY_COLORS: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
};

// Default target location (pfSense firewall — approximate geographic center)
const TARGET_COORDS: [number, number] = [78.9629, 20.5937]; // India

// ─── Mock Data Generator ────────────────────────────────────────
function generateMockAttacks(): GeoStats {
    const attacks: GeoAttack[] = [
        { id: 'g1', srcIp: '185.220.101.42', lat: 55.7558, lng: 37.6173, country: 'Russia', countryCode: 'RU', city: 'Moscow', severity: 'critical', classification: 'brute_force', count: 847, lastSeen: new Date(Date.now() - 30000).toISOString() },
        { id: 'g2', srcIp: '101.36.100.25', lat: 39.9042, lng: 116.4074, country: 'China', countryCode: 'CN', city: 'Beijing', severity: 'high', classification: 'port_scan', count: 623, lastSeen: new Date(Date.now() - 60000).toISOString() },
        { id: 'g3', srcIp: '45.33.32.156', lat: 37.7749, lng: -122.4194, country: 'United States', countryCode: 'US', city: 'San Francisco', severity: 'medium', classification: 'web_attack', count: 312, lastSeen: new Date(Date.now() - 120000).toISOString() },
        { id: 'g4', srcIp: '177.54.148.20', lat: -23.5505, lng: -46.6333, country: 'Brazil', countryCode: 'BR', city: 'São Paulo', severity: 'high', classification: 'ddos', count: 534, lastSeen: new Date(Date.now() - 45000).toISOString() },
        { id: 'g5', srcIp: '91.108.52.15', lat: 52.5200, lng: 13.4050, country: 'Germany', countryCode: 'DE', city: 'Berlin', severity: 'medium', classification: 'reconnaissance', count: 189, lastSeen: new Date(Date.now() - 180000).toISOString() },
        { id: 'g6', srcIp: '103.152.220.44', lat: 28.6139, lng: 77.2090, country: 'India', countryCode: 'IN', city: 'New Delhi', severity: 'low', classification: 'port_scan', count: 97, lastSeen: new Date(Date.now() - 300000).toISOString() },
        { id: 'g7', srcIp: '196.216.168.53', lat: -33.9249, lng: 18.4241, country: 'South Africa', countryCode: 'ZA', city: 'Cape Town', severity: 'high', classification: 'ssh_anomaly', count: 256, lastSeen: new Date(Date.now() - 90000).toISOString() },
        { id: 'g8', srcIp: '5.188.86.10', lat: 48.8566, lng: 2.3522, country: 'France', countryCode: 'FR', city: 'Paris', severity: 'medium', classification: 'dns_tunneling', count: 143, lastSeen: new Date(Date.now() - 240000).toISOString() },
        { id: 'g9', srcIp: '42.112.24.60', lat: 21.0285, lng: 105.8542, country: 'Vietnam', countryCode: 'VN', city: 'Hanoi', severity: 'critical', classification: 'brute_force', count: 761, lastSeen: new Date(Date.now() - 15000).toISOString() },
        { id: 'g10', srcIp: '175.45.176.1', lat: 39.0392, lng: 125.7625, country: 'North Korea', countryCode: 'KP', city: 'Pyongyang', severity: 'critical', classification: 'data_exfiltration', count: 43, lastSeen: new Date(Date.now() - 600000).toISOString() },
        { id: 'g11', srcIp: '200.160.2.3', lat: 19.4326, lng: -99.1332, country: 'Mexico', countryCode: 'MX', city: 'Mexico City', severity: 'medium', classification: 'web_attack', count: 178, lastSeen: new Date(Date.now() - 200000).toISOString() },
        { id: 'g12', srcIp: '31.13.76.35', lat: 41.0082, lng: 28.9784, country: 'Turkey', countryCode: 'TR', city: 'Istanbul', severity: 'high', classification: 'ddos', count: 412, lastSeen: new Date(Date.now() - 75000).toISOString() },
    ];

    const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
    const countryMap = new Map<string, { country: string; code: string; count: number }>();

    for (const a of attacks) {
        severityBreakdown[a.severity]++;
        const existing = countryMap.get(a.countryCode);
        if (existing) {
            existing.count += a.count;
        } else {
            countryMap.set(a.countryCode, { country: a.country, code: a.countryCode, count: a.count });
        }
    }

    return {
        totalAttacks: attacks.reduce((sum, a) => sum + a.count, 0),
        uniqueCountries: countryMap.size,
        topCountries: Array.from(countryMap.values()).sort((a, b) => b.count - a.count),
        severityBreakdown,
        attacks,
    };
}

// ─── Map Geography (memoized for performance) ───────────────────
const MapGeographies = memo(function MapGeographies() {
    return (
        <Geographies geography={GEO_URL}>
            {({ geographies }) =>
                geographies.map((geo) => (
                    <Geography
                        key={String(geo.rsSVGElement?.key ?? geo.properties?.name ?? '')}
                        geography={geo}
                        fill="#1a1a3a"
                        stroke="#00d9ff"
                        strokeWidth={0.3}
                        strokeOpacity={0.2}
                        style={{
                            default: { outline: 'none' },
                            hover: { fill: '#252560', outline: 'none' },
                            pressed: { outline: 'none' },
                        }}
                    />
                ))
            }
        </Geographies>
    );
});

// ─── Component ──────────────────────────────────────────────────
export function ThreatMapPage() {
    const [geoData, setGeoData] = useState<GeoStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [selectedAttack, setSelectedAttack] = useState<GeoAttack | null>(null);
    const [showArcs, setShowArcs] = useState(true);

    const fetchGeoData = useCallback(async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/geo/attacks`);
            if (response.ok) {
                const data = await response.json();
                setGeoData(data);
            } else {
                setGeoData(generateMockAttacks());
            }
        } catch {
            setGeoData(generateMockAttacks());
        } finally {
            setLoading(false);
            setLastRefresh(new Date());
        }
    }, []);

    useEffect(() => {
        fetchGeoData();
        const interval = setInterval(fetchGeoData, 15000);
        return () => clearInterval(interval);
    }, [fetchGeoData]);

    if (loading || !geoData) {
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/30">
                        <Globe className="h-5 w-5 text-red-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">Global Threat Map</h1>
                        <p className="text-sm text-muted-foreground">Real-time geospatial attack visualization</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* LIVE indicator */}
                    <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-1.5">
                        <div className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </div>
                        <span className="text-xs font-medium text-red-400">LIVE</span>
                    </div>
                    <button
                        onClick={fetchGeoData}
                        className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-red-400" />
                        <span className="text-xs text-muted-foreground">Total Attacks</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400">{geoData.totalAttacks.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <Globe className="h-4 w-4 text-orange-400" />
                        <span className="text-xs text-muted-foreground">Source Countries</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-400">{geoData.uniqueCountries}</p>
                </div>
                <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-xs text-muted-foreground">Critical Threats</span>
                    </div>
                    <p className="text-2xl font-bold text-red-500">{geoData.severityBreakdown.critical}</p>
                </div>
                <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-xs text-muted-foreground">Last Update</span>
                    </div>
                    <p className="text-sm font-medium text-primary">{lastRefresh.toLocaleTimeString()}</p>
                </div>
            </div>

            {/* Map + Sidebar */}
            <div className="grid grid-cols-[1fr_320px] gap-4">
                {/* Map */}
                <div
                    className="relative rounded-lg border border-border overflow-hidden"
                    style={{ background: '#0a0a1a' }}
                >
                    {/* CSS for pulsing markers */}
                    <style>{`
            @keyframes threat-pulse {
              0%   { transform: scale(1); opacity: 0.9; }
              50%  { transform: scale(1.8); opacity: 0.3; }
              100% { transform: scale(2.5); opacity: 0; }
            }
            .threat-marker-pulse {
              animation: threat-pulse 2s ease-out infinite;
            }
          `}</style>

                    <ComposableMap
                        projectionConfig={{ scale: 147, center: [10, 10] }}
                        style={{ width: '100%', height: 'auto', background: 'transparent' }}
                    >
                        <MapGeographies />

                        {/* Attack arc lines (source → target) */}
                        {showArcs && geoData.attacks.map((attack) => (
                            <Line
                                key={`arc-${attack.id}`}
                                from={[attack.lng, attack.lat]}
                                to={TARGET_COORDS}
                                stroke={SEVERITY_COLORS[attack.severity] || '#6366f1'}
                                strokeWidth={1}
                                strokeOpacity={0.4}
                                strokeLinecap="round"
                                style={{ pointerEvents: 'none' }}
                            />
                        ))}

                        {/* Target Marker (pfSense HQ) */}
                        <Marker coordinates={TARGET_COORDS}>
                            <circle r={6} fill="#00d9ff" opacity={0.8} />
                            <circle r={10} fill="none" stroke="#00d9ff" strokeWidth={1.5} opacity={0.5} />
                            <circle r={15} fill="none" stroke="#00d9ff" strokeWidth={1} opacity={0.2} />
                        </Marker>

                        {/* Attack Source Markers */}
                        {geoData.attacks.map((attack) => {
                            const color = SEVERITY_COLORS[attack.severity] || '#6366f1';
                            const radius = Math.max(3, Math.min(8, Math.log2(attack.count)));
                            return (
                                <Marker
                                    key={attack.id}
                                    coordinates={[attack.lng, attack.lat]}
                                    onClick={() => setSelectedAttack(attack)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {/* Pulse ring */}
                                    <circle r={radius * 2} fill={color} opacity={0.15} className="threat-marker-pulse" />
                                    {/* Core dot */}
                                    <circle r={radius} fill={color} opacity={0.85} stroke={color} strokeWidth={0.5} />
                                </Marker>
                            );
                        })}
                    </ComposableMap>

                    {/* Map Legend */}
                    <div className="absolute bottom-4 left-4 rounded-lg bg-black/70 backdrop-blur-sm border border-border p-3 space-y-1.5">
                        <p className="text-xs font-medium text-foreground mb-2">Severity</p>
                        {Object.entries(SEVERITY_COLORS).map(([level, color]) => (
                            <div key={level} className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                                <span className="text-xs text-muted-foreground capitalize">{level}</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-2 pt-1 border-t border-border mt-1">
                            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                            <span className="text-xs text-muted-foreground">Target (HQ)</span>
                        </div>
                    </div>

                    {/* Arc toggle */}
                    <button
                        onClick={() => setShowArcs(!showArcs)}
                        className={`absolute top-4 right-4 rounded-lg px-3 py-1.5 text-xs border ${showArcs ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card/50 border-border text-muted-foreground'} transition-colors`}
                    >
                        {showArcs ? '🎯 Arcs ON' : '🎯 Arcs OFF'}
                    </button>

                    {/* Selected Attack Detail Overlay */}
                    {selectedAttack && (
                        <div className="absolute top-4 left-4 rounded-lg bg-black/80 backdrop-blur-md border border-border p-4 max-w-xs">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <Crosshair className="h-4 w-4 text-red-400" />
                                    <span className="text-sm font-medium">{selectedAttack.srcIp}</span>
                                </div>
                                <button
                                    onClick={() => setSelectedAttack(null)}
                                    className="text-muted-foreground hover:text-foreground text-xs"
                                >✕</button>
                            </div>
                            <div className="space-y-1 text-xs">
                                <p><span className="text-muted-foreground">Location:</span> {selectedAttack.city}, {selectedAttack.country}</p>
                                <p><span className="text-muted-foreground">Attacks:</span> <span className="text-red-400 font-medium">{selectedAttack.count.toLocaleString()}</span></p>
                                <p><span className="text-muted-foreground">Classification:</span> {selectedAttack.classification?.replace(/_/g, ' ')}</p>
                                {selectedAttack.classification && (() => {
                                    const mitre = getMitreTechnique(selectedAttack.classification);
                                    return mitre ? (
                                        <p>
                                            <span className="text-muted-foreground">MITRE:</span>{' '}
                                            <a href={mitre.url} target="_blank" rel="noopener noreferrer" className={`font-mono text-xs px-1.5 py-0.5 rounded ${getMitreSeverityColor(mitre.severity)}`}>
                                                {mitre.id}
                                            </a>{' '}
                                            <span className="text-muted-foreground">{mitre.name}</span>
                                        </p>
                                    ) : null;
                                })()}
                                <div className="flex items-center gap-1 mt-1">
                                    <div className="h-2 w-2 rounded-full" style={{ background: SEVERITY_COLORS[selectedAttack.severity] }} />
                                    <span className="capitalize" style={{ color: SEVERITY_COLORS[selectedAttack.severity] }}>{selectedAttack.severity}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar — Top Attacking Countries */}
                <div className="space-y-4">
                    {/* Severity Breakdown */}
                    <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
                        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            Severity Distribution
                        </h3>
                        <div className="space-y-2">
                            {(['critical', 'high', 'medium', 'low'] as const).map((level) => {
                                const count = geoData.severityBreakdown[level];
                                const total = geoData.attacks.length;
                                const pct = total > 0 ? (count / total) * 100 : 0;
                                return (
                                    <div key={level}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="capitalize" style={{ color: SEVERITY_COLORS[level] }}>{level}</span>
                                            <span className="text-muted-foreground">{count}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%`, background: SEVERITY_COLORS[level] }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Top Countries */}
                    <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
                        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-orange-400" />
                            Top Attack Origins
                        </h3>
                        <div className="space-y-2">
                            {geoData.topCountries.slice(0, 8).map((c, i) => (
                                <div key={c.code} className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                                    <span className="text-xs font-mono text-muted-foreground w-6">{c.code}</span>
                                    <span className="text-xs flex-1 truncate">{c.country}</span>
                                    <span className="text-xs font-medium text-red-400">{c.count.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* MITRE Kill Chain Active */}
                    <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
                        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-purple-400" />
                            Active MITRE Tactics
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                            {Array.from(new Set(
                                geoData.attacks
                                    .map(a => getMitreTechnique(a.classification || ''))
                                    .filter(Boolean)
                                    .map(t => t!.tactic)
                            )).map(tactic => (
                                <span
                                    key={tactic}
                                    className="text-xs px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300"
                                >
                                    {tactic}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
