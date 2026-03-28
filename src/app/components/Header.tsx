import {
  Bell, Shield, LogOut, Sun, Moon, Settings,
  Wifi, WifiOff, RefreshCw, ChevronDown, Server,
  Database, Cpu, Globe, Activity, UserCircle,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { DiceBearAvatar } from './ui/DiceBearAvatar';
import { CommandPalette } from './ui/CommandPalette';

interface HeaderProps {
  currentUser: { username: string; role: string };
  onLogout: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onNavigate: (tab: string) => void;
}

type ConnStatus = 'connected' | 'disconnected' | 'testing';

interface ConnectionState {
  pfsense: ConnStatus;
  backend: ConnStatus;
  grafana: ConnStatus;
  ai: ConnStatus;
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose]);
}


const STATUS_DOT: Record<ConnStatus, string> = {
  connected: 'bg-success',
  disconnected: 'bg-destructive',
  testing: 'bg-warning animate-pulse',
};

const STATUS_LABEL: Record<ConnStatus, string> = {
  connected: 'Connected',
  disconnected: 'Offline',
  testing: 'Testing…',
};

const STATUS_TEXT: Record<ConnStatus, string> = {
  connected: 'text-success',
  disconnected: 'text-destructive',
  testing: 'text-warning',
};

export function Header({ currentUser, onLogout, theme, onToggleTheme, onNavigate }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [connections, setConnections] = useState<ConnectionState>({
    pfsense: 'testing',
    backend: 'testing',
    grafana: 'testing',
    ai: 'testing',
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const connMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(userMenuRef, () => setShowUserMenu(false));
  useClickOutside(connMenuRef, () => setShowConnections(false));

  const checkConnections = useCallback(async () => {
    setIsRefreshing(true);
    setConnections({ pfsense: 'testing', backend: 'testing', grafana: 'testing', ai: 'testing' });

    const saved = localStorage.getItem('firewallai_config');
    const cfg = saved ? JSON.parse(saved) : { backendUrl: '192.168.1.101', backendPort: '3001', grafanaUrl: '192.168.1.101', grafanaPort: '3000' };

    // Backend check
    const backendOk = await fetch(`http://${cfg.backendUrl}:${cfg.backendPort}/health`)
      .then(r => r.ok)
      .catch(() => false);
    setConnections(prev => ({ ...prev, backend: backendOk ? 'connected' : 'disconnected' }));

    // pfSense check (via backend proxy)
    const pfsenseOk = await fetch(`http://${cfg.backendUrl}:${cfg.backendPort}/api/pfsense/status`)
      .then(r => r.ok)
      .catch(() => false);
    setConnections(prev => ({ ...prev, pfsense: pfsenseOk ? 'connected' : 'disconnected' }));

    // Grafana check (demo: assume connected since CORS blocks real check)
    const grafanaOk = await fetch(`http://${cfg.grafanaUrl}:${cfg.grafanaPort}/api/health`, { mode: 'no-cors' })
      .then(() => true)
      .catch(() => false);
    setConnections(prev => ({ ...prev, grafana: grafanaOk ? 'connected' : 'disconnected' }));

    // AI check (demo: always connected)
    setConnections(prev => ({ ...prev, ai: 'connected' }));

    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    checkConnections();
  }, [checkConnections]);

  const connectedCount = Object.values(connections).filter(s => s === 'connected').length;
  const totalCount = Object.values(connections).length;
  const allConnected = connectedCount === totalCount;

  const CONN_ITEMS = [
    { key: 'pfsense' as const, label: 'pfSense Firewall', icon: Shield, desc: 'Firewall & routing' },
    { key: 'backend' as const, label: 'Backend API', icon: Server, desc: 'Node.js data bridge' },
    { key: 'grafana' as const, label: 'Grafana', icon: Database, desc: 'Metrics dashboard' },
    { key: 'ai' as const, label: 'AI Engine', icon: Cpu, desc: 'Threat intelligence' },
  ];

  return (
    <header
      className="h-16 border-b border-border backdrop-blur-md"
      style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(16px)' }}
    >
      <div className="flex h-full items-center justify-between px-6">
        {/* Title */}
        <div>
          <h1 className="text-base font-semibold text-foreground leading-tight">
            Modern Firewall Architectures
          </h1>
          <p className="text-xs text-muted-foreground">
            Big Data, Logging, and Open-Source Innovation
          </p>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-3">
          {/* Command Palette */}
          <CommandPalette onNavigate={onNavigate} />

          {/* Active Protection badge */}
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-1.5">
            <Shield className="h-4 w-4 text-success" aria-hidden="true" />
            <span className="text-sm text-success font-medium">Active Protection</span>
          </div>

          {/* Connection Status Dropdown */}
          <div className="relative" ref={connMenuRef}>
            <button
              onClick={() => { setShowConnections(v => !v); setShowUserMenu(false); }}
              aria-label="System connection status"
              aria-expanded={showConnections}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ background: 'var(--glass-bg)' }}
            >
              {allConnected
                ? <Wifi className="h-4 w-4 text-success" aria-hidden="true" />
                : <WifiOff className="h-4 w-4 text-destructive" aria-hidden="true" />
              }
              <span className="hidden sm:block text-sm font-medium">
                <span className={allConnected ? 'text-success' : 'text-destructive'}>
                  {connectedCount}/{totalCount}
                </span>
                <span className="text-muted-foreground ml-1">Online</span>
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${showConnections ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {showConnections && (
              <div
                className="absolute right-0 mt-2 w-72 rounded-xl border border-border shadow-2xl overflow-hidden z-50"
                style={{ background: 'var(--popover)', backdropFilter: 'blur(20px)' }}
                role="menu"
                aria-label="Connection status panel"
              >
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="text-sm font-semibold text-foreground">System Connections</span>
                  </div>
                  <button
                    onClick={checkConnections}
                    disabled={isRefreshing}
                    aria-label="Refresh connection status"
                    className="rounded-md p-1.5 hover:bg-muted transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                  </button>
                </div>

                {/* Connection items */}
                <div className="p-2 flex flex-col gap-1">
                  {CONN_ITEMS.map(({ key, label, icon: Icon, desc }) => (
                    <div
                      key={key}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${connections[key] === 'connected' ? 'bg-success/10' : connections[key] === 'testing' ? 'bg-warning/10' : 'bg-destructive/10'}`}>
                        <Icon
                          className={`h-4 w-4 ${connections[key] === 'connected' ? 'text-success' : connections[key] === 'testing' ? 'text-warning' : 'text-destructive'}`}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{label}</p>
                        <p className="text-xs text-muted-foreground truncate">{desc}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`inline-flex h-2 w-2 rounded-full ${STATUS_DOT[connections[key]]}`} />
                        <span className={`text-xs font-medium ${STATUS_TEXT[connections[key]]}`}>
                          {STATUS_LABEL[connections[key]]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-border bg-muted/20">
                  <button
                    onClick={() => { setShowConnections(false); onNavigate('settings'); }}
                    className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors focus-visible:outline-none"
                  >
                    <Settings className="h-3 w-3" aria-hidden="true" />
                    Manage connections in Settings
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded-lg p-2 hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {theme === 'dark'
              ? <Sun className="h-5 w-5 text-amber-400" aria-hidden="true" />
              : <Moon className="h-5 w-5 text-indigo-500" aria-hidden="true" />
            }
          </button>

          {/* Notifications */}
          <button
            aria-label="Notifications — new alerts available"
            className="relative rounded-lg p-2 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
            </span>
          </button>

          {/* User profile */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => { setShowUserMenu(v => !v); setShowConnections(false); }}
              aria-label={`User menu for ${currentUser.username}`}
              aria-expanded={showUserMenu}
              className="flex items-center gap-2.5 rounded-xl border border-border px-2.5 py-1.5 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(8px)' }}
            >
              {/* DiceBear avatar */}
              <div className="h-7 w-7 rounded-full overflow-hidden shrink-0 border border-border bg-muted">
                <DiceBearAvatar seed={currentUser.username} size={28} />
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-sm font-semibold text-foreground leading-none mb-0.5">
                  {currentUser.username}
                </div>
                <div className="text-xs text-muted-foreground leading-none">
                  {currentUser.role}
                </div>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground hidden sm:block transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {showUserMenu && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-xl border border-border shadow-2xl overflow-hidden z-50"
                style={{ background: 'var(--popover)', backdropFilter: 'blur(20px)' }}
                role="menu"
                aria-label="User account menu"
              >
                {/* User info header */}
                <div className="px-4 py-3.5 border-b border-border">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full overflow-hidden shrink-0 border border-border bg-muted">
                      <DiceBearAvatar seed={currentUser.username} size={40} />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm font-semibold text-foreground leading-tight">{currentUser.username}</p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">{currentUser.role}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success shrink-0" aria-hidden="true" />
                        <span className="text-xs font-medium text-success">Active session</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="p-1.5" role="group">
                  <button
                    onClick={() => { setShowUserMenu(false); onNavigate('profile'); }}
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <UserCircle className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>My Profile</span>
                  </button>
                  <button
                    onClick={() => { setShowUserMenu(false); onNavigate('settings'); }}
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span>Settings</span>
                  </button>
                  <button
                    onClick={() => { setShowUserMenu(false); onNavigate('ai-insights'); }}
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span>AI Insights</span>
                  </button>
                </div>

                {/* Divider + Logout */}
                <div className="p-1.5 border-t border-border">
                  <button
                    onClick={() => { setShowUserMenu(false); onLogout(); }}
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
