import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Globe, Zap } from 'lucide-react';

interface AttackEvent {
  id: string;
  sourceIP: string;
  targetPort: number;
  severity: 'high' | 'medium' | 'low';
  timestamp: number;
  domain?: string;
}

export function LiveAttackPulse() {
  const [attacks, setAttacks] = useState<AttackEvent[]>([]);
  const [pulseIntensity, setPulseIntensity] = useState(0);

  // Generate random attacks
  useEffect(() => {
    const interval = setInterval(() => {
      const severities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
      const sourceIPs = ['192.168.1.45', '192.168.1.102', '10.0.0.15', '172.16.0.23', '203.0.113.45'];
      const domains = ['malicious.com', 'phishing.site', 'botnet.net', 'exploit.io'];
      const ports = [22, 80, 443, 3389, 8080, 445];

      const newAttack: AttackEvent = {
        id: Math.random().toString(36).substr(2, 9),
        sourceIP: sourceIPs[Math.floor(Math.random() * sourceIPs.length)]!,
        targetPort: ports[Math.floor(Math.random() * ports.length)]!,
        severity: severities[Math.floor(Math.random() * severities.length)]!,
        timestamp: Date.now(),
        domain: domains[Math.floor(Math.random() * domains.length)],
      };

      setAttacks(prev => [newAttack, ...prev.slice(0, 4)]);
      setPulseIntensity(1);
      setTimeout(() => setPulseIntensity(0), 600);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const severityConfig = {
    high: { color: '#ff3b57', bg: 'rgba(255,59,87,0.1)', border: 'rgba(255,59,87,0.3)' },
    medium: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
    low: { color: '#00d9ff', bg: 'rgba(0,217,255,0.1)', border: 'rgba(0,217,255,0.3)' },
  };

  return (
    <div className="space-y-4">
      {/* Pulse Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative h-3 w-3">
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-red-500"
            />
            <div className="relative h-3 w-3 rounded-full bg-red-500" />
          </div>
          <span className="text-xs font-semibold text-foreground">Live Attack Feed</span>
        </div>
        <span className="text-xs text-muted-foreground">{attacks.length} active</span>
      </div>

      {/* Attack Events */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {attacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Zap className="h-6 w-6 mb-2 opacity-25" />
            <p className="text-xs">Monitoring for threats...</p>
          </div>
        ) : (
          attacks.map((attack, idx) => {
            const config = severityConfig[attack.severity];
            return (
              <motion.div
                key={attack.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="p-3 rounded-lg border transition-all"
                style={{
                  background: config.bg,
                  border: `1px solid ${config.border}`,
                }}
              >
                <div className="flex items-start gap-2.5">
                  <motion.div
                    animate={idx === 0 ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="shrink-0 mt-0.5"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" style={{ color: config.color }} />
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-foreground truncate">
                        Attack from {attack.sourceIP}
                      </p>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 uppercase"
                        style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
                      >
                        {attack.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Port {attack.targetPort} • {attack.domain || 'Unknown'}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(attack.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Global Pulse Animation */}
      <motion.div
        animate={{ opacity: [0, pulseIntensity, 0] }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,59,87,0.2) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}
