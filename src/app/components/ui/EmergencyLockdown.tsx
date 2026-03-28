import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Lock, Unlock, Shield, Zap, Clock } from 'lucide-react';

interface LockdownZone {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  devices: number;
}

export function EmergencyLockdown() {
  const [isLockdownActive, setIsLockdownActive] = useState(false);
  const [lockdownCountdown, setLockdownCountdown] = useState<number | null>(null);
  const [zones, setZones] = useState<LockdownZone[]>([
    { id: '1', name: 'DMZ', status: 'inactive', devices: 12 },
    { id: '2', name: 'Internal Network', status: 'inactive', devices: 45 },
    { id: '3', name: 'Guest Network', status: 'inactive', devices: 8 },
    { id: '4', name: 'Server Farm', status: 'inactive', devices: 28 },
  ]);

  const handleEmergencyLockdown = () => {
    if (!isLockdownActive) {
      // Start countdown before activation
      setLockdownCountdown(3);
      const interval = setInterval(() => {
        setLockdownCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            setIsLockdownActive(true);
            setZones(prev => prev.map(z => ({ ...z, status: 'active' })));
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Deactivate lockdown
      setIsLockdownActive(false);
      setZones(prev => prev.map(z => ({ ...z, status: 'inactive' })));
    }
  };

  return (
    <div className="space-y-4">
      {/* Lockdown Button */}
      <motion.button
        onClick={handleEmergencyLockdown}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full py-4 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-3 ${
          isLockdownActive
            ? 'bg-red-500/20 border-2 border-red-500 text-red-400 hover:bg-red-500/30'
            : 'bg-red-500/10 border-2 border-red-500/50 text-red-400 hover:bg-red-500/20'
        }`}
      >
        {isLockdownActive ? (
          <>
            <Lock className="h-5 w-5 animate-pulse" />
            <span>LOCKDOWN ACTIVE</span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-5 w-5" />
            <span>ACTIVATE EMERGENCY LOCKDOWN</span>
          </>
        )}
      </motion.button>

      {/* Countdown Timer */}
      <AnimatePresence>
        {lockdownCountdown !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center justify-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30"
          >
            <Clock className="h-4 w-4 text-red-400 animate-spin" />
            <span className="text-sm font-semibold text-red-400">
              Lockdown activating in {lockdownCountdown}s...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lockdown Status */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Network Zones</h3>
        </div>

        <div className="space-y-2">
          {zones.map(zone => (
            <motion.div
              key={zone.id}
              animate={{
                background: zone.status === 'active'
                  ? 'rgba(255,59,87,0.15)'
                  : 'rgba(0,217,255,0.05)',
                borderColor: zone.status === 'active'
                  ? 'rgba(255,59,87,0.3)'
                  : 'var(--glass-border)',
              }}
              className="p-3 rounded-lg border transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={zone.status === 'active' ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: zone.status === 'active' ? '#ff3b57' : '#10b981',
                      boxShadow: zone.status === 'active'
                        ? '0 0 8px rgba(255,59,87,0.6)'
                        : 'none',
                    }}
                  />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{zone.name}</p>
                    <p className="text-[10px] text-muted-foreground">{zone.devices} devices</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {zone.status === 'active' ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Lock className="h-3.5 w-3.5 text-red-400" />
                    </motion.div>
                  ) : (
                    <Unlock className="h-3.5 w-3.5 text-green-400" />
                  )}
                  <span className="text-xs font-semibold" style={{
                    color: zone.status === 'active' ? '#ff3b57' : '#10b981',
                  }}>
                    {zone.status === 'active' ? 'LOCKED' : 'OPEN'}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {isLockdownActive && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20"
        >
          <p className="text-xs font-semibold text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Lockdown Active
          </p>
          <p className="text-xs text-muted-foreground">
            All network zones are restricted. External traffic is blocked. Contact your security team for assistance.
          </p>
          <button
            onClick={handleEmergencyLockdown}
            className="w-full mt-2 py-2 px-3 rounded text-xs font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Deactivate Lockdown
          </button>
        </motion.div>
      )}
    </div>
  );
}
