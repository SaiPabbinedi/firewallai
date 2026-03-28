import {
  LayoutDashboard, FileText, Shield, BarChart3, Brain,
  Settings, Terminal, Activity, Cpu, Globe, Bot,
  ShieldAlert, Menu, Sun, Moon, ChevronRight, Waypoints,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const sections = [
  {
    label: 'Core',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Security overview & blocked domains' },
      { id: 'terminal', label: 'Terminal Hub', icon: Terminal, description: 'PowerShell, CMD & secure browser' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { id: 'logs', label: 'Logs', icon: FileText, description: 'Real-time pfSense log stream' },
      { id: 'grafana', label: 'Grafana', icon: Activity, description: 'Embedded monitoring dashboards' },
      { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Traffic trends & statistics' },
      { id: 'threat-map', label: 'Threat Map', icon: Globe, description: 'Global attack visualization' },
      { id: 'network-flow', label: 'Network', icon: Waypoints, description: 'Packet flow & topology map' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'vuln-feed', label: 'Vulnerabilities', icon: ShieldAlert, description: 'Latest CVE & exploit news' },
      { id: 'ai-insights', label: 'AI Insights', icon: Brain, description: 'ML-powered threat detection' },
      { id: 'ai-metrics', label: 'AI Metrics', icon: Cpu, description: 'Model performance & analytics' },
      { id: 'chat', label: 'Expert Chat', icon: Bot, description: 'Cybersecurity AI assistant' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'firewall', label: 'Firewall Rules', icon: Shield, description: 'Manage pfSense firewall rules' },
      { id: 'settings', label: 'Settings', icon: Settings, description: 'Configure connections & AI' },
    ],
  },
];

export function Sidebar({ activeTab, onTabChange, collapsed, onToggleCollapsed, theme, onToggleTheme }: SidebarProps) {
  return (
    <aside
      className="fixed left-0 top-0 h-screen border-r border-border z-50 shadow-xl flex flex-col transition-all duration-300 ease-in-out"
      style={{
        width: collapsed ? 64 : 220,
        background: 'var(--sidebar)',
        borderColor: 'var(--sidebar-border)',
      }}
    >
      {/* Logo + hamburger */}
      <div
        className="flex h-16 items-center border-b shrink-0 px-3"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        <button
          onClick={onToggleCollapsed}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-primary/10 shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className="h-5 w-5 text-primary" />
        </button>

        {!collapsed && (
          <div className="ml-2 min-w-0 overflow-hidden">
            <div className="text-sm font-semibold text-foreground truncate">FirewallAI</div>
            <div className="text-xs text-muted-foreground truncate">pfSense Integration</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-4">
        {sections.map((section) => (
          <div key={section.label}>
            {/* Section label — hidden when collapsed */}
            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                {section.label}
              </p>
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    title={collapsed ? `${item.label} — ${item.description}` : item.description}
                    className={`
                      group relative flex w-full items-center rounded-lg py-2 transition-all duration-150
                      ${collapsed ? 'justify-center px-0' : 'gap-3 px-2.5'}
                      ${isActive
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                      }
                    `}
                    style={{
                      background: isActive ? 'var(--sidebar-accent)' : 'transparent',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-accent)';
                    }}
                    onMouseLeave={e => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    {/* Active left-border indicator */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 h-[60%] w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                        style={{ boxShadow: '0 0 8px var(--primary)' }}
                      />
                    )}

                    <Icon
                      className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
                    />

                    {!collapsed && (
                      <>
                        <span className="flex-1 min-w-0 text-left text-sm font-medium truncate">
                          {item.label}
                        </span>
                        {isActive && (
                          <ChevronRight className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: status + theme toggle */}
      <div
        className="shrink-0 border-t p-3 space-y-2"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        {/* System status */}
        <div
          className={`flex items-center rounded-lg py-2 border ${collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'}`}
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            borderColor: 'rgba(16, 185, 129, 0.2)',
          }}
        >
          <div className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-xs font-medium text-emerald-500">System Active</div>
              <div className="text-xs text-muted-foreground truncate">pfSense Connected</div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className={`flex w-full items-center rounded-lg py-2 transition-colors hover:bg-primary/10 text-muted-foreground hover:text-foreground ${collapsed ? 'justify-center px-0' : 'gap-3 px-2.5'}`}
        >
          {theme === 'dark'
            ? <Sun className="h-[18px] w-[18px] shrink-0 text-amber-400" />
            : <Moon className="h-[18px] w-[18px] shrink-0 text-indigo-400" />
          }
          {!collapsed && (
            <span className="text-sm font-medium">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          )}
        </button>

        {/* Version */}
        {!collapsed && (
          <p className="text-center text-[10px] text-muted-foreground/40 select-none pt-1">
            FirewallAI v1.1 · pfSense 2.7+
          </p>
        )}
      </div>
    </aside>
  );
}
