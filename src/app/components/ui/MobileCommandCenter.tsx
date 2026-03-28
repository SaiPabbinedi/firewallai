import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Bell,
  Shield,
  AlertTriangle,
  CheckCircle,
  X,
  ChevronRight,
  Lock,
} from 'lucide-react';

interface MobileAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  action?: {
    label: string;
    callback: () => void;
  };
  timestamp: string;
}

interface MobileCommandCenterProps {
  alerts?: MobileAlert[];
  onBlockIP?: (ip: string) => void;
  onDismissAlert?: (alertId: string) => void;
  isPWA?: boolean;
}

export function MobileCommandCenter({
  alerts = defaultAlerts,
  onBlockIP,
  onDismissAlert,
  isPWA = false,
}: MobileCommandCenterProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Request notification permission
  useEffect(() => {
    if (isPWA && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          setNotificationsEnabled(permission === 'granted');
        });
      }
    }
  }, [isPWA]);

  // Send push notification for critical alerts
  useEffect(() => {
    const criticalAlert = alerts.find(a => a.severity === 'critical');
    if (criticalAlert && notificationsEnabled && isPWA) {
      new Notification('Critical Security Alert', {
        body: criticalAlert.message,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: criticalAlert.id,
        requireInteraction: true,
      });
    }
  }, [alerts, notificationsEnabled, isPWA]);

  const visibleAlerts = alerts.filter(a => !dismissedAlerts.has(a.id));

  const handleDismiss = (alertId: string) => {
    const newDismissed = new Set(dismissedAlerts);
    newDismissed.add(alertId);
    setDismissedAlerts(newDismissed);
    onDismissAlert?.(alertId);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#ff3b57';
      case 'warning':
        return '#fbbf24';
      default:
        return '#00d9ff';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-6 h-6" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6" />;
      default:
        return <Bell className="w-6 h-6" />;
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 pb-20">
      {/* Header */}
      <motion.div
        className="sticky top-0 z-40 px-4 py-4 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-sm"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-lg font-bold text-white">FirewallAI</h1>
              <p className="text-xs text-slate-400">Mobile Command Center</p>
            </div>
          </div>
          {isPWA && (
            <motion.div
              className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-semibold"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              PWA
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Alerts Section */}
      <div className="px-4 py-4 space-y-3">
        {visibleAlerts.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center py-12 text-slate-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <CheckCircle className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">All systems secure</p>
            <p className="text-xs text-slate-500 mt-1">No active alerts</p>
          </motion.div>
        ) : (
          visibleAlerts.map((alert) => (
            <MobileAlertCard
              key={alert.id}
              alert={alert}
              isSelected={selectedAlert === alert.id}
              onSelect={() => setSelectedAlert(
                selectedAlert === alert.id ? null : alert.id
              )}
              onDismiss={() => handleDismiss(alert.id)}
              onBlock={onBlockIP}
              severityColor={getSeverityColor(alert.severity)}
              severityIcon={getSeverityIcon(alert.severity)}
            />
          ))
        )}
      </div>

      {/* Quick Actions */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-slate-950/95 backdrop-blur-sm border-t border-slate-800/50"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="flex gap-2">
          <motion.button
            className="flex-1 py-3 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 font-medium text-sm transition-all"
            whileHover={{ scale: 1.02, background: 'rgba(0, 217, 255, 0.3)' }}
            whileTap={{ scale: 0.98 }}
          >
            <Shield className="w-4 h-4 inline mr-2" />
            Lockdown
          </motion.button>
          <motion.button
            className="flex-1 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 font-medium text-sm transition-all"
            whileHover={{ scale: 1.02, background: 'rgba(100, 100, 100, 0.2)' }}
            whileTap={{ scale: 0.98 }}
          >
            <Bell className="w-4 h-4 inline mr-2" />
            Settings
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// Mobile Alert Card with Slide-to-Confirm Gesture
function MobileAlertCard({
  alert,
  isSelected,
  onSelect,
  onDismiss,
  onBlock,
  severityColor,
  severityIcon,
}: {
  alert: MobileAlert;
  isSelected: boolean;
  onSelect: () => void;
  onDismiss: () => void;
  onBlock?: (ip: string) => void;
  severityColor: string;
  severityIcon: React.ReactNode;
}) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, 0], [0, 1]);
  const scale = useTransform(x, [-100, 0], [0.8, 1]);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = (info: any) => {
    if (info.offset.x < -80) {
      onDismiss();
    } else {
      x.set(0);
    }
  };

  return (
    <motion.div
      ref={dragRef}
      drag="x"
      dragElastic={0.2}
      dragConstraints={{ left: -150, right: 0 }}
      onDragEnd={handleDragEnd}
      style={{ x, opacity, scale }}
      className="relative"
    >
      {/* Dismiss indicator */}
      <motion.div
        className="absolute inset-0 rounded-lg flex items-center justify-end pr-4"
        style={{
          background: 'rgba(255, 59, 87, 0.2)',
          opacity: useTransform(x, [0, -100], [0, 1]),
        }}
      >
        <X className="w-5 h-5 text-red-400" />
      </motion.div>

      {/* Alert card */}
      <motion.div
        onClick={onSelect}
        className="p-4 rounded-lg border transition-all cursor-pointer"
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderColor: severityColor + '40',
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-start gap-3">
          <div
            className="p-2 rounded-lg flex-shrink-0"
            style={{ background: severityColor + '20' }}
          >
            <div style={{ color: severityColor }}>
              {severityIcon}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm">{alert.title}</h3>
            <p className="text-xs text-slate-300 mt-1">{alert.message}</p>
            <p className="text-xs text-slate-500 mt-2">{alert.timestamp}</p>
          </div>

          <ChevronRight
            className="w-5 h-5 text-slate-500 flex-shrink-0"
            style={{
              transform: isSelected ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          />
        </div>

        {/* Expanded details */}
        {isSelected && (
          <motion.div
            className="mt-4 pt-4 border-t border-slate-700/50 space-y-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {alert.action && (
              <SlideToConfirmButton
                label={alert.action.label}
                onConfirm={alert.action.callback}
              />
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

// Slide-to-Confirm Button Component
function SlideToConfirmButton({
  label,
  onConfirm,
}: {
  label: string;
  onConfirm: () => void;
}) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [0, 100], [0.5, 1]);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = (info: any) => {
    if (info.offset.x > 80) {
      onConfirm();
      x.set(0);
    } else {
      x.set(0);
    }
  };

  return (
    <div className="relative h-12 bg-slate-800/50 rounded-lg overflow-hidden border border-slate-700">
      {/* Background text */}
      <div className="absolute inset-0 flex items-center justify-end pr-4 text-slate-400 text-sm font-medium">
        Slide to confirm →
      </div>

      {/* Draggable button */}
      <motion.div
        ref={dragRef}
        drag="x"
        dragElastic={0.2}
        dragConstraints={{ left: 0, right: 100 }}
        onDragEnd={handleDragEnd}
        style={{ x, opacity }}
        className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <Lock className="w-5 h-5 text-white" />
      </motion.div>

      {/* Text */}
      <div className="absolute inset-0 flex items-center justify-center text-white font-medium text-sm">
        {label}
      </div>
    </div>
  );
}

// Default alerts for demonstration
const defaultAlerts: MobileAlert[] = [
  {
    id: 'alert-1',
    severity: 'critical',
    title: 'Port Scan Detected',
    message: 'Suspicious port scanning activity from 203.0.113.45',
    timestamp: '14:32:01',
    action: {
      label: 'Block IP',
      callback: () => console.log('Blocking IP'),
    },
  },
  {
    id: 'alert-2',
    severity: 'warning',
    title: 'Unusual DNS Activity',
    message: 'High volume of DNS queries from internal host 192.168.1.75',
    timestamp: '14:33:15',
  },
  {
    id: 'alert-3',
    severity: 'info',
    title: 'Firewall Rule Updated',
    message: 'New rule #2847 has been activated',
    timestamp: '14:30:00',
  },
];
