import { useState } from 'react';
import {
  Shield, Activity, Clock, Key, Globe, Server,
  Lock, User, Edit2, CheckCircle, AlertTriangle,
  BarChart2, Terminal, Cpu, Database, Settings,
  Calendar, LogIn, ChevronRight
} from 'lucide-react';
import { DiceBearAvatar } from './ui/DiceBearAvatar';

interface ProfilePageProps {
  currentUser: { username: string; role: string };
  onNavigate: (tab: string) => void;
}

const STAT_CARDS = [
  { label: 'Firewall Rules', value: '247', delta: '+12 this week', icon: Shield, color: 'text-success', bg: 'bg-success/10' },
  { label: 'Threats Blocked', value: '1,842', delta: '+98 today', icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
  { label: 'Logs Reviewed', value: '38.4k', delta: 'Last 30 days', icon: Activity, color: 'text-primary', bg: 'bg-primary/10' },
  { label: 'AI Queries', value: '126', delta: '+8 today', icon: Cpu, color: 'text-chart-2', bg: 'bg-chart-2/10' },
];

const RECENT_ACTIVITY = [
  { action: 'Updated firewall rule #89 — Block China ASN', time: '2 min ago', icon: Shield, color: 'text-primary' },
  { action: 'Reviewed critical CVE-2025-0234 vulnerability', time: '18 min ago', icon: AlertTriangle, color: 'text-destructive' },
  { action: 'Generated AI threat analysis for 192.168.50.x/24', time: '1 hr ago', icon: Cpu, color: 'text-success' },
  { action: 'Exported Grafana dashboard snapshot', time: '3 hrs ago', icon: Database, color: 'text-warning' },
  { action: 'Signed in from 192.168.1.12 (Chrome / Windows)', time: 'Today 09:14', icon: LogIn, color: 'text-muted-foreground' },
  { action: 'Modified Suricata IDS rule set', time: 'Yesterday 21:42', icon: Settings, color: 'text-muted-foreground' },
  { action: 'Detected anomalous traffic pattern on VLAN 20', time: 'Yesterday 19:15', icon: Activity, color: 'text-warning' },
  { action: 'Updated threat intelligence feed "Blocklist Pro"', time: 'Yesterday 14:30', icon: Shield, color: 'text-success' },
];

const PERMISSIONS = [
  { label: 'Firewall Management', granted: true },
  { label: 'Log Access (read/write)', granted: true },
  { label: 'AI Engine Control', granted: true },
  { label: 'User Administration', granted: false },
  { label: 'Grafana Dashboard Edit', granted: true },
  { label: 'System Configuration', granted: false },
  { label: 'Network Flow Analysis', granted: true },
  { label: 'Terminal Root Access', granted: false },
];

const QUICK_LINKS = [
  { label: 'Firewall Rules', tab: 'firewall', icon: Shield, desc: 'Manage security policies' },
  { label: 'AI Insights', tab: 'ai-insights', icon: Cpu, desc: 'Threat analysis engine' },
  { label: 'Analytics', tab: 'analytics', icon: BarChart2, desc: 'Network traffic data' },
  { label: 'Terminal', tab: 'terminal', icon: Terminal, desc: 'Direct CLI console' },
  { label: 'Settings', tab: 'settings', icon: Settings, desc: 'System configuration' },
  { label: 'Grafana', tab: 'grafana', icon: Database, desc: 'Visual monitoring' },
];


export function ProfilePage({ currentUser, onNavigate }: ProfilePageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser.username);
  const [department, setDepartment] = useState('Security Operations');
  const [location, setLocation] = useState('HQ — Network Lab');
  const [editBuffer, setEditBuffer] = useState({ displayName, department, location });

  const sessionStart = new Date(Date.now() - 1000 * 60 * 47); // 47 min ago
  const lastLogin = 'Today at 09:14';

  const handleSave = () => {
    setDisplayName(editBuffer.displayName);
    setDepartment(editBuffer.department);
    setLocation(editBuffer.location);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditBuffer({ displayName, department, location });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Page heading */}
      <div className="shrink-0">
        <h2 className="text-2xl font-semibold text-foreground">My Profile</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your account information and view system activity
        </p>
      </div>

      {/* Top row: Profile card + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 shrink-0">

        {/* Profile Identity Card */}
        <div
          className="lg:col-span-1 rounded-xl border border-border p-6 flex flex-col gap-5"
          style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(16px)' }}
        >
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div
                className="rounded-2xl overflow-hidden border-2 border-primary/30"
                style={{ boxShadow: '0 0 28px color-mix(in srgb, var(--primary) 28%, transparent)' }}
              >
                <DiceBearAvatar seed={currentUser.username} size={80} glow />
              </div>
              <span
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-success"
                title="Online"
              />
            </div>

            {isEditing ? (
              <input
                value={editBuffer.displayName}
                onChange={e => setEditBuffer(p => ({ ...p, displayName: e.target.value }))}
                className="w-full rounded-lg border border-border bg-input-background px-3 py-1.5 text-center text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Display name"
                autoComplete="name"
              />
            ) : (
              <div className="text-center">
                <p className="text-base font-bold text-foreground">{displayName}</p>
                <p className="text-sm text-muted-foreground">{currentUser.role}</p>
              </div>
            )}
          </div>

          {/* Info fields */}
          <div className="space-y-3 flex-1">
            <InfoRow
              icon={User}
              label="Username"
              value={currentUser.username}
              editable={false}
            />
            <InfoRow
              icon={Shield}
              label="Role"
              value={currentUser.role}
              editable={false}
            />
            {isEditing ? (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground block">Department</label>
                <input
                  value={editBuffer.department}
                  onChange={e => setEditBuffer(p => ({ ...p, department: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  autoComplete="organization"
                />
                <label className="text-xs text-muted-foreground block">Location</label>
                <input
                  value={editBuffer.location}
                  onChange={e => setEditBuffer(p => ({ ...p, location: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  autoComplete="address-level2"
                />
              </div>
            ) : (
              <>
                <InfoRow icon={Globe} label="Department" value={department} />
                <InfoRow icon={Server} label="Location" value={location} />
              </>
            )}
            <InfoRow icon={Calendar} label="Last Login" value={lastLogin} />
            <InfoRow icon={Clock} label="Session" value={`Active · ${formatSessionTime(sessionStart)}`} />
          </div>

          {/* Edit / Save actions */}
          {isEditing ? (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 rounded-lg py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 rounded-lg py-2 text-sm font-medium hover:bg-muted transition-colors border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
              Edit Profile
            </button>
          )}
        </div>

        {/* Stats grid */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4 content-stretch">
          {STAT_CARDS.map(({ label, value, delta, icon: Icon, color, bg }) => (
            <div
              key={label}
              className="rounded-xl border border-border p-5 flex flex-col justify-center"
              style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-4.5 w-4.5 ${color}`} style={{ width: 18, height: 18 }} aria-hidden="true" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
              <p className="text-xs text-primary mt-1.5">{delta}</p>
            </div>
          ))}

          {/* Quick Access links - Redesigned to fill space */}
          <div
            className="col-span-2 rounded-xl border border-border p-5 flex flex-col"
            style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Quick Access
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 flex-1">
              {QUICK_LINKS.map(({ label, tab, icon: Icon, desc }) => (
                <button
                  key={tab}
                  onClick={() => onNavigate(tab)}
                  className="flex items-center gap-3 rounded-xl p-3 border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-left"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Activity + Permissions - Set to grow and fill available space */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-0">

        {/* Recent Activity */}
        <div
          className="rounded-xl border border-border p-5 flex flex-col min-h-0"
          style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}
        >
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
          </div>
          <div className="space-y-1 overflow-y-auto custom-scrollbar pr-2 flex-1" aria-live="polite">
            {RECENT_ACTIVITY.map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/40 transition-colors">
                <item.icon className={`h-4 w-4 mt-0.5 shrink-0 ${item.color}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground leading-snug">{item.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Permissions + Security */}
        <div className="flex flex-col gap-5 min-h-0">
          {/* Permissions - Expanded to fill more space */}
          <div
            className="rounded-xl border border-border p-5 flex-1 flex flex-col min-h-0"
            style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}
          >
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <Key className="h-4 w-4 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">Access Permissions</h3>
            </div>
            <div className="space-y-1 overflow-y-auto custom-scrollbar pr-2 flex-1">
              {PERMISSIONS.map(({ label, granted }) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/40 transition-colors">
                  <span className="text-sm text-foreground">{label}</span>
                  {granted ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-success shrink-0">
                      <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Granted
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0">
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      Restricted
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Security Info */}
          <div
            className="rounded-xl border border-border p-5 shrink-0"
            style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-4 w-4 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">Security</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Session token</span>
                <span className="font-mono text-xs text-foreground bg-muted rounded px-2 py-0.5 select-all">
                  ••••••••••••a3f9
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Authentication</span>
                <span className="text-xs font-medium text-success">Password + Session</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">2FA</span>
                <span className="text-xs font-medium text-warning">Not configured</span>
              </div>
              <div className="pt-1">
                <button
                  onClick={() => onNavigate('settings')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                  Security Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper components ────────────────────────────────────────────────────────

interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
  editable?: boolean;
}

function InfoRow({ icon: Icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted/30">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

function formatSessionTime(start: Date): string {
  const diffMs = Date.now() - start.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
