import { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './components/DashboardPage';
import { LogsPage } from './components/LogsPage';
import { FirewallRulesPage } from './components/FirewallRulesPage';
import { AnalyticsPage } from './components/AnalyticsPage';
import { AIInsightsPage } from './components/AIInsightsPage';
import { AIMetricsPage } from './components/AIMetricsPage';
import { SettingsPage } from './components/SettingsPage';
import { ThreatMapPage } from './components/ThreatMapPage';
import { TopologyPage } from './components/TopologyPage';
import { GrafanaPage } from './components/GrafanaPage';
import { TerminalPage } from './components/Terminal/TerminalPage';
import { TerminalSessionProvider } from './components/Terminal/TerminalSessionManager';
// ── NEW PAGES ──
import { ChatPage } from './components/ChatPage';
import { VulnerabilityFeedPage } from './components/VulnerabilityFeedPage';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState({ username: '', role: '' });

  // ── Chat context state (for article → chat navigation) ──
  const [chatContext, setChatContext] = useState<string | undefined>(undefined);
  const [chatInitialQuestion, setChatInitialQuestion] = useState<string | undefined>(undefined);

  useEffect(() => {
    const savedSession = localStorage.getItem('firewallai_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setIsAuthenticated(true);
        setCurrentUser(session);
      } catch (e) {
        console.error("Session parse error", e);
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

  /**
   * Navigate from a vulnerability article to the chat page
   * with the article context pre-loaded.
   */
  const navigateToChat = (context: string, question: string) => {
    setChatContext(context);
    setChatInitialQuestion(question);
    setActiveTab('chat');
  };

  // Clear chat context when navigating away from chat
  const handleTabChange = (tab: string) => {
    if (tab !== 'chat') {
      setChatContext(undefined);
      setChatInitialQuestion(undefined);
    }
    setActiveTab(tab);
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'terminal':
        return <TerminalPage />;
      case 'logs':
        return <LogsPage />;
      case 'firewall':
        return <FirewallRulesPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'threat-map':
        return <ThreatMapPage />;
      case 'topology':
        return <TopologyPage />;
      case 'ai-insights':
        return <AIInsightsPage />;
      case 'ai-metrics':
        return <AIMetricsPage />;
      case 'settings':
        return <SettingsPage />;
      // ── NEW PAGES ──
      case 'chat':
        return (
          <ChatPage
            initialContext={chatContext}
            initialQuestion={chatInitialQuestion}
          />
        );
      case 'vuln-feed':
        return (
          <VulnerabilityFeedPage
            onNavigateToChat={navigateToChat}
          />
        );
      case 'grafana':
        return null; // Rendered persistently below
      default:
        return <DashboardPage />;
    }
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} error={loginError} />;
  }

  return (
    <TerminalSessionProvider>
      <div className="min-h-screen relative bg-background font-sans text-foreground overflow-hidden">
        {/* Background Grid */}
        <div
          className="fixed inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 217, 255, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 217, 255, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />

        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="fixed top-0 left-64 right-0 z-40">
          <Header currentUser={currentUser} onLogout={handleLogout} />
        </div>

        <main className="ml-64 pt-20 h-screen overflow-y-auto relative z-10 p-8">
          <div className="mx-auto max-w-[1600px] pb-10">
            {/* Persistent Grafana */}
            <div style={{ display: activeTab === 'grafana' ? 'block' : 'none' }}>
              <GrafanaPage />
            </div>

            {activeTab !== 'grafana' && renderPage()}
          </div>
        </main>
      </div>
    </TerminalSessionProvider>
  );
}
