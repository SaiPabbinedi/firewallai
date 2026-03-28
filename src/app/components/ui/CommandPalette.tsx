import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Shield, Activity, AlertTriangle, Settings,
  Terminal, BarChart3, Network, Zap, Lock,
  Eye, FileText, Users, HelpCircle, Command, X,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  shortcut?: string;
}

interface CommandPaletteProps {
  onNavigate?: (tab: string) => void;
}

export function CommandPalette({ onNavigate }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'View security overview',
      icon: <Activity className="h-5 w-5" />,
      action: () => onNavigate?.('dashboard'),
      category: 'Navigation',
      shortcut: 'D',
    },
    {
      id: 'threats',
      label: 'Active Threats',
      description: 'Monitor active threats',
      icon: <AlertTriangle className="h-5 w-5" />,
      action: () => onNavigate?.('threat-map'),
      category: 'Navigation',
      shortcut: 'T',
    },
    {
      id: 'firewall',
      label: 'Firewall Rules',
      description: 'Manage firewall rules',
      icon: <Shield className="h-5 w-5" />,
      action: () => onNavigate?.('firewall'),
      category: 'Navigation',
      shortcut: 'F',
    },
    {
      id: 'network',
      label: 'Network Topology',
      description: 'View network topology',
      icon: <Network className="h-5 w-5" />,
      action: () => onNavigate?.('topology'),
      category: 'Navigation',
      shortcut: 'N',
    },
    {
      id: 'logs',
      label: 'Logs',
      description: 'View system logs',
      icon: <FileText className="h-5 w-5" />,
      action: () => onNavigate?.('logs'),
      category: 'Navigation',
      shortcut: 'L',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      description: 'View analytics',
      icon: <BarChart3 className="h-5 w-5" />,
      action: () => onNavigate?.('analytics'),
      category: 'Navigation',
      shortcut: 'A',
    },
    {
      id: 'terminal',
      label: 'Terminal',
      description: 'Open terminal',
      icon: <Terminal className="h-5 w-5" />,
      action: () => onNavigate?.('terminal'),
      category: 'Navigation',
      shortcut: 'M',
    },
    {
      id: 'ai-insights',
      label: 'AI Insights',
      description: 'View AI-powered insights',
      icon: <Zap className="h-5 w-5" />,
      action: () => onNavigate?.('ai-insights'),
      category: 'Navigation',
      shortcut: 'I',
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Configure settings',
      icon: <Settings className="h-5 w-5" />,
      action: () => onNavigate?.('settings'),
      category: 'Navigation',
      shortcut: 'S',
    },
    {
      id: 'lockdown',
      label: 'Emergency Lockdown',
      description: 'Activate emergency lockdown mode',
      icon: <Lock className="h-5 w-5" />,
      action: () => {
        alert('Emergency Lockdown activated! Network is now in restricted mode.');
        setIsOpen(false);
      },
      category: 'Actions',
      shortcut: 'Ctrl+L',
    },
    {
      id: 'help',
      label: 'Help & Documentation',
      description: 'View help and documentation',
      icon: <HelpCircle className="h-5 w-5" />,
      action: () => alert('Help documentation coming soon!'),
      category: 'Help',
    },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.description.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to open
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(!isOpen);
        setSearch('');
        setSelectedIndex(0);
      }

      // Close on Escape
      if (e.key === 'Escape') {
        setIsOpen(false);
      }

      // Navigate with arrow keys
      if (isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            setIsOpen(false);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, search, selectedIndex, filteredCommands]);

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-xs text-muted-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search...</span>
        <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border">
          <Command className="h-3 w-3 inline" /> K
        </kbd>
      </button>

      {/* Full-Page Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Animated background blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xl"
            />

            {/* Animated grid background */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[60] pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(0, 255, 255, 0.08) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0, 255, 255, 0.08) 1px, transparent 1px)
                `,
                backgroundSize: '50px 50px',
              }}
            />

            {/* Floating accent orbs */}
            <motion.div
              className="fixed inset-0 z-[60] pointer-events-none overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="absolute top-1/4 -left-32 h-64 w-64 rounded-full blur-3xl opacity-20"
                style={{
                  background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)',
                }}
                animate={{
                  y: [0, 40, 0],
                  x: [0, 30, 0],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <motion.div
                className="absolute bottom-1/4 -right-32 h-80 w-80 rounded-full blur-3xl opacity-15"
                style={{
                  background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)',
                }}
                animate={{
                  y: [0, -40, 0],
                  x: [0, -30, 0],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </motion.div>

            {/* Main Command Palette Container */}
            <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[10vh] pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: -20 }}
                animate={{ opacity: 1, scale: 0.75, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: -20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                onClick={e => e.stopPropagation()}
                className="w-[90vw] max-w-4xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl pointer-events-auto origin-top"
                style={{
                  transformOrigin: 'top center',
                  background: 'rgba(20, 24, 40, 0.9)',
                  backdropFilter: 'blur(24px)',
                  border: '1px solid rgba(0, 255, 255, 0.3)',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                }}
              >
                {/* Animated gradient top border */}
                <motion.div
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.5), transparent)',
                  }}
                  animate={{
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />

                {/* Search Input Section */}
                <motion.div
                  className="relative flex items-center gap-4 px-8 py-6 border-b border-cyan-500/30 bg-gradient-to-b from-cyan-500/15 to-transparent"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  <Search className="h-4.5 w-4.5 text-primary flex-shrink-0" />

                  <input
                    autoFocus
                    type="text"
                    placeholder="Search commands, navigate pages, or perform actions..."
                    value={search}
                    onChange={e => {
                      setSearch(e.target.value);
                      setSelectedIndex(0);
                    }}
                    className="flex-1 bg-transparent outline-none text-xl text-foreground placeholder-muted-foreground/50 font-medium"
                  />

                  <motion.button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </motion.button>
                </motion.div>

                {/* Commands List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {filteredCommands.length === 0 ? (
                    <motion.div
                      className="flex flex-col items-center justify-center h-full text-center py-16 px-8"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <motion.div
                        className="p-6 rounded-full bg-muted/30 mb-6"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Search className="h-10 w-10 text-muted-foreground/50" />
                      </motion.div>
                      <p className="text-muted-foreground text-xl font-semibold">No commands found</p>
                      <p className="text-muted-foreground/60 text-base mt-2">Try searching for something else</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      {Object.entries(groupedCommands).map(([category, items], categoryIdx) => (
                        <motion.div
                          key={category}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + categoryIdx * 0.05 }}
                          className="border-b border-cyan-500/20 last:border-b-0"
                        >
                          <motion.div
                            className="px-8 py-3 text-xs font-bold text-cyan-300 uppercase tracking-widest bg-cyan-500/10 sticky top-0 backdrop-blur-sm"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            {category}
                          </motion.div>

                          {items.map((cmd, idx) => {
                            const globalIdx = filteredCommands.findIndex(c => c.id === cmd.id);
                            const isSelected = globalIdx === selectedIndex;

                            return (
                              <motion.button
                                key={cmd.id}
                                onClick={() => {
                                  cmd.action();
                                  setIsOpen(false);
                                }}
                                onMouseEnter={() => setSelectedIndex(globalIdx)}
                                whileHover={{ x: 8 }}
                                transition={{ duration: 0.15 }}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className={`w-full px-8 py-4 flex items-center gap-5 transition-all text-left relative group ${
                                  isSelected
                                    ? 'bg-cyan-500/25 border-l-4 border-cyan-400'
                                    : 'hover:bg-cyan-500/15 border-l-4 border-transparent'
                                }`}
                              >
                                {/* Animated background for selected item */}
                                {isSelected && (
                                  <motion.div
                                    className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-transparent"
                                    layoutId="selectedBg"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.2 }}
                                  />
                                )}

                                {/* Icon */}
                                <motion.div
                                  className={`flex-shrink-0 transition-colors ${isSelected ? 'text-cyan-300' : 'text-cyan-400/60'}`}
                                  animate={isSelected ? { scale: [1, 1.1, 1] } : {}}
                                  transition={{ duration: 0.5, repeat: Infinity }}
                                >
                                  {cmd.icon}
                                </motion.div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 relative z-10">
                                  <motion.div
                                    className={`text-lg font-semibold ${isSelected ? 'text-cyan-300' : 'text-white'}`}
                                    animate={isSelected ? { x: [0, 4, 0] } : {}}
                                    transition={{ duration: 1, repeat: Infinity }}
                                  >
                                    {cmd.label}
                                  </motion.div>
                                  <div className="text-sm text-cyan-400/60 mt-1">{cmd.description}</div>
                                </div>

                                {/* Shortcut */}
                                {cmd.shortcut && (
                                  <motion.div
                                    className="text-xs text-cyan-400/60 ml-4 shrink-0 bg-cyan-500/15 px-3 py-1.5 rounded border border-cyan-500/30 font-mono"
                                    animate={isSelected ? { scale: [1, 1.05, 1] } : {}}
                                    transition={{ duration: 0.5, repeat: Infinity }}
                                  >
                                    {cmd.shortcut}
                                  </motion.div>
                                )}
                              </motion.button>
                            );
                          })}
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>

                {/* Footer */}
                <motion.div
                  className="px-8 py-4 border-t border-cyan-500/20 bg-gradient-to-t from-cyan-500/10 to-transparent flex items-center justify-between text-xs text-cyan-400/70 shrink-0"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <div className="flex gap-6 flex-wrap">
                    <motion.span className="flex items-center gap-2" whileHover={{ scale: 1.05 }}>
                      <kbd className="bg-cyan-500/15 border border-cyan-500/30 rounded px-2 py-1 text-[10px] font-mono">↑↓</kbd>
                      Navigate
                    </motion.span>
                    <motion.span className="flex items-center gap-2" whileHover={{ scale: 1.05 }}>
                      <kbd className="bg-cyan-500/15 border border-cyan-500/30 rounded px-2 py-1 text-[10px] font-mono">⏎</kbd>
                      Select
                    </motion.span>
                    <motion.span className="flex items-center gap-2" whileHover={{ scale: 1.05 }}>
                      <kbd className="bg-cyan-500/15 border border-cyan-500/30 rounded px-2 py-1 text-[10px] font-mono">ESC</kbd>
                      Close
                    </motion.span>
                  </div>
                  <motion.span
                    className="hidden sm:block text-cyan-300 font-semibold"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    Cmd+K to open
                  </motion.span>
                </motion.div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
