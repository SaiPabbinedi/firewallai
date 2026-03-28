import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPageEnhanced } from './components/DashboardPageEnhanced';
import { LogsPage } from './components/LogsPage';
import { FirewallRulesPage } from './components/FirewallRulesPage';
import { AnalyticsPage } from './components/AnalyticsPage';
import { AIInsightsPage } from './components/AIInsightsPage';
import { AIMetricsPage } from './components/AIMetricsPage';
import { SettingsPage } from './components/SettingsPage';
import { ThreatMapPage } from './components/ThreatMapPage';
import { GrafanaPage } from './components/GrafanaPage';
import { TerminalPage } from './components/Terminal/TerminalPage';
import { TerminalSessionProvider } from './components/Terminal/TerminalSessionManager';
import { ChatPage } from './components/ChatPage';
import { VulnerabilityFeedPage } from './components/VulnerabilityFeedPage';
import { ProfilePage } from './components/ProfilePage';
import { NetworkFlowPage } from './components/NetworkFlowPage';

const SIDEBAR_FULL = 220;
const SIDEBAR_COLLAPSED = 64;

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState({ username: '', role: '' });
  const [chatContext, setChatContext] = useState<string | undefined>(undefined);
  const [chatInitialQuestion, setChatInitialQuestion] = useState<string | undefined>(undefined);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('firewallai_theme') as 'dark' | 'light') || 'dark';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.remove('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('firewallai_theme', theme);
  }, [theme]);

  useEffect(() => {
    const savedSession = localStorage.getItem('firewallai_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setIsAuthenticated(true);
        setCurrentUser(session);
      } catch (e) {
        console.error('Session parse error', e);
      }
    }
  }, []);

  const handleLogin = (username: string, password: string) => {
    if (username === 'admin' && password === 'firewall123') {
      const user = { username, role: 'Network Ops' };
      setIsAuthenticated(true);
      setCurrentUser(user);
      setLoginError('');
      localStorage.setItem('firewallai_session', JSON.stringify(user));
    } else {
      setLoginError('Invalid username or password. Please try again.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser({ username: '', role: '' });
    localStorage.removeItem('firewallai_session');
    setActiveTab('dashboard');
  };

  const navigateToChat = (context: string, question: string) => {
    setChatContext(context);
    setChatInitialQuestion(question);
    setActiveTab('chat');
  };

  const handleTabChange = (tab: string) => {
    if (tab !== 'chat') {
      setChatContext(undefined);
      setChatInitialQuestion(undefined);
    }
    setActiveTab(tab);
  };

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  const toggleSidebar = () => setSidebarCollapsed(c => !c);

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_FULL;

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardPageEnhanced />;
      case 'terminal': return <TerminalPage />;
      case 'logs': return <LogsPage />;
      case 'firewall': return <FirewallRulesPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'threat-map': return <ThreatMapPage />;
      case 'topology': return <NetworkFlowPage />;
      case 'ai-insights': return <AIInsightsPage />;
      case 'ai-metrics': return <AIMetricsPage />;
      case 'settings': return <SettingsPage />;
      case 'chat': return <ChatPage initialContext={chatContext} initialQuestion={chatInitialQuestion} />;
      case 'vuln-feed': return <VulnerabilityFeedPage onNavigateToChat={navigateToChat} />;
      case 'profile': return <ProfilePage currentUser={currentUser} onNavigate={handleTabChange} />;
      case 'network-flow': return <NetworkFlowPage />;
      case 'grafana': return null;
      default: return <DashboardPage />;
    }
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} error={loginError} />;
  }

  return (
    <TerminalSessionProvider>
      <div className="min-h-screen relative bg-background font-sans text-foreground overflow-hidden">
        {/* Background grid — adapts via CSS variable */}
        <div
          className="fixed inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(var(--grid-line) 1px, transparent 1px),
              linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />

        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Header tracks sidebar width */}
        <div
          className="fixed top-0 right-0 z-40 transition-all duration-300 ease-in-out"
          style={{ left: sidebarWidth }}
        >
          <Header
            currentUser={currentUser}
            onLogout={handleLogout}
            theme={theme}
            onToggleTheme={toggleTheme}
            onNavigate={handleTabChange}
          />
        </div>

        {/* Main content tracks sidebar width */}
        <main
          className="pt-16 h-screen overflow-y-auto relative z-10 px-6 pb-6 transition-all duration-300 ease-in-out"
          style={{ marginLeft: sidebarWidth }}
        >
          <div className="mx-auto max-w-[1600px] pb-10 pt-6">
            {/* Persistent Grafana */}
            <div style={{ display: activeTab === 'grafana' ? 'block' : 'none' }}>
              <GrafanaPage />
            </div>

            <AnimatePresence mode="wait">
              {activeTab !== 'grafana' && (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  {renderPage()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </TerminalSessionProvider>
  );
}
