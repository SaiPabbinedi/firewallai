import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Network,
  Shield,
  AlertTriangle,
  Settings,
  LogOut,
  Bell,
} from 'lucide-react';

interface SidebarAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
}

interface SidebarEnhancedProps {
  alerts?: SidebarAlert[];
  currentPage?: string;
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}

export function SidebarEnhanced({
  alerts = [],
  currentPage = 'dashboard',
  onNavigate,
  onLogout,
}: SidebarEnhancedProps) {
  const [expandedAlerts, setExpandedAlerts] = useState(false);
  const [pulseActive, setPulseActive] = useState(false);

  // Trigger pulse animation when critical alert arrives
  useEffect(() => {
    const hasCritical = alerts.some(a => a.severity === 'critical');
    if (hasCritical) {
      setPulseActive(true);
      const timer = setTimeout(() => setPulseActive(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [alerts]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'network', label: 'Network', icon: Network },
    { id: 'firewall', label: 'Firewall', icon: Shield },
    { id: 'threats', label: 'Threats', icon: AlertTriangle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

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

  return (
    <motion.div
      className="h-screen w-64 flex flex-col bg-gradient-to-b from-slate-950 to-slate-900 border-r border-slate-800/50"
      initial={{ x: -256 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-800/50">
        <motion.div
          className="flex items-center gap-3"
          whileHover={{ scale: 1.02 }}
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">FirewallAI</h1>
            <p className="text-xs text-slate-400">Security Command Center</p>
          </div>
        </motion.div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => onNavigate?.(item.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative group"
              style={{
                background: isActive
                  ? 'rgba(0, 217, 255, 0.15)'
                  : 'transparent',
              }}
              whileHover={{
                background: 'rgba(0, 217, 255, 0.1)',
                x: 4,
              }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-500 rounded-r-full"
                  layoutId="activeIndicator"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}

              <Icon className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
              <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </nav>

      {/* Alerts Section */}
      <motion.div
        className="px-3 py-4 border-t border-slate-800/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Alert Bell with Pulse */}
        <motion.button
          onClick={() => setExpandedAlerts(!expandedAlerts)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-all relative"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Pulse Animation */}
          {pulseActive && (
            <>
              <motion.div
                className="absolute inset-0 rounded-lg border border-red-500"
                animate={{
                  scale: [1, 1.2],
                  opacity: [1, 0],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                }}
              />
              <motion.div
                className="absolute inset-0 rounded-lg border border-red-500"
                animate={{
                  scale: [1, 1.2],
                  opacity: [1, 0],
                }}
                transition={{
                  duration: 0.6,
                  delay: 0.2,
                  repeat: Infinity,
                }}
              />
            </>
          )}

          <div className="relative">
            <Bell className="w-5 h-5 text-slate-400" />
            {alerts.length > 0 && (
              <motion.div
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{
                  background: criticalCount > 0 ? '#ff3b57' : '#fbbf24',
                }}
                animate={pulseActive ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                {alerts.length}
              </motion.div>
            )}
          </div>

          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-slate-300">
              {alerts.length === 0 ? 'No alerts' : `${alerts.length} Alert${alerts.length !== 1 ? 's' : ''}`}
            </p>
            <p className="text-xs text-slate-500">
              {criticalCount > 0 && `${criticalCount} critical`}
              {criticalCount > 0 && warningCount > 0 && ', '}
              {warningCount > 0 && `${warningCount} warning`}
            </p>
          </div>

          <motion.div
            animate={{ rotate: expandedAlerts ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <AlertTriangle className="w-4 h-4 text-slate-400" />
          </motion.div>
        </motion.button>

        {/* Expanded Alerts List */}
        <AnimatePresence>
          {expandedAlerts && alerts.length > 0 && (
            <motion.div
              className="mt-2 space-y-2 max-h-48 overflow-y-auto"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {alerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  className="p-2 rounded-lg text-xs"
                  style={{
                    background: getSeverityColor(alert.severity) + '15',
                    borderLeft: `2px solid ${getSeverityColor(alert.severity)}`,
                  }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  <p className="font-semibold text-slate-200 truncate">
                    {alert.message}
                  </p>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    {alert.timestamp}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Logout Button */}
      <motion.div
        className="px-3 py-4 border-t border-slate-800/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <motion.button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Logout</span>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
