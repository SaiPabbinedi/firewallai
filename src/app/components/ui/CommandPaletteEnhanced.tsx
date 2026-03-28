import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, AlertTriangle, Shield, Zap } from 'lucide-react';

interface Command {
  id: string;
  name: string;
  category: string;
  description: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action: (args?: any) => void | Promise<void>;
  pattern?: RegExp; // For action shortcuts like /block
}

interface CommandPaletteEnhancedProps {
  commands?: Command[];
  isOpen?: boolean;
  onClose?: () => void;
  onCommandExecute?: (commandId: string) => void;
}

export function CommandPaletteEnhanced({
  commands = defaultCommands,
  isOpen = false,
  onClose,
  onCommandExecute,
}: CommandPaletteEnhancedProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actionMode, setActionMode] = useState(false);
  const [actionTarget, setActionTarget] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Parse action shortcuts (e.g., /block 192.168.1.50)
  const parseActionShortcut = (query: string) => {
    const blockMatch = query.match(/^\/block\s+(.+)$/i);
    const allowMatch = query.match(/^\/allow\s+(.+)$/i);
    const queryMatch = query.match(/^\/query\s+(.+)$/i);

    if (blockMatch) {
      return { action: 'block', target: blockMatch[1] };
    }
    if (allowMatch) {
      return { action: 'allow', target: allowMatch[1] };
    }
    if (queryMatch) {
      return { action: 'query', target: queryMatch[1] };
    }
    return null;
  };

  const shortcutParsed = parseActionShortcut(search);

  // Filter commands based on search
  const filteredCommands = search.trim() === ''
    ? commands
    : commands.filter(cmd =>
        cmd.name.toLowerCase().includes(search.toLowerCase()) ||
        cmd.description.toLowerCase().includes(search.toLowerCase()) ||
        cmd.category.toLowerCase().includes(search.toLowerCase())
      );

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose?.();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % flatCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + flatCommands.length) % flatCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (shortcutParsed) {
        handleActionShortcut(shortcutParsed);
      } else if (flatCommands[selectedIndex]) {
        executeCommand(flatCommands[selectedIndex]);
      }
    }
  };

  const flatCommands = Object.values(groupedCommands).flat();

  const executeCommand = async (cmd: Command) => {
    setIsExecuting(true);
    try {
      await cmd.action();
      onCommandExecute?.(cmd.id);
      onClose?.();
    } finally {
      setIsExecuting(false);
    }
  };

  const handleActionShortcut = async (parsed: { action: string; target: string }) => {
    setIsExecuting(true);
    try {
      const actionCmd = commands.find(c => c.id === parsed.action);
      if (actionCmd) {
        await actionCmd.action({ target: parsed.target });
        onCommandExecute?.(parsed.action);
        onClose?.();
      }
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-start justify-center pt-[10vh] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Command Palette */}
        <motion.div
          className="relative w-[90vw] max-w-2xl max-h-[70vh] rounded-xl overflow-hidden shadow-2xl pointer-events-auto"
          style={{
            background: 'rgba(20, 24, 40, 0.95)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(0, 255, 255, 0.3)',
          }}
          initial={{ opacity: 0, scale: 0.85, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: -20 }}
          transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Input Section */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-cyan-500/30 bg-gradient-to-b from-cyan-500/10 to-transparent">
            <Search className="w-5 h-5 text-primary flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search commands or use /block, /allow, /query..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent outline-none text-lg text-foreground placeholder-muted-foreground/50 font-medium"
            />
            <motion.button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </motion.button>
          </div>

          {/* Action Shortcut Preview */}
          {shortcutParsed && (
            <motion.div
              className="px-6 py-3 bg-orange-500/10 border-b border-orange-500/30"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-foreground">
                  Ready to execute: <span className="font-mono font-semibold text-orange-400">
                    {shortcutParsed.action.toUpperCase()}
                  </span> on <span className="font-mono text-orange-300">
                    {shortcutParsed.target}
                  </span>
                </span>
              </div>
            </motion.div>
          )}

          {/* Commands List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredCommands.length === 0 ? (
              <motion.div
                className="flex flex-col items-center justify-center h-full text-center py-16 px-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Search className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-lg font-semibold">No commands found</p>
                <p className="text-muted-foreground/60 text-sm mt-2">Try a different search term</p>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                {Object.entries(groupedCommands).map(([category, items], categoryIdx) => (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + categoryIdx * 0.05 }}
                  >
                    {/* Category Header */}
                    <div className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category}
                    </div>

                    {/* Commands */}
                    {items.map((cmd, cmdIdx) => {
                      const globalIdx = Object.values(groupedCommands)
                        .slice(0, categoryIdx)
                        .reduce((sum, arr) => sum + arr.length, 0) + cmdIdx;

                      return (
                        <motion.button
                          key={cmd.id}
                          onClick={() => executeCommand(cmd)}
                          className="w-full px-6 py-3 flex items-center gap-3 transition-all text-left"
                          style={{
                            background: selectedIndex === globalIdx
                              ? 'rgba(0, 217, 255, 0.1)'
                              : 'transparent',
                          }}
                          whileHover={{
                            background: 'rgba(0, 217, 255, 0.15)',
                          }}
                          disabled={isExecuting}
                        >
                          {cmd.icon && (
                            <div className="flex-shrink-0 w-5 h-5 text-primary">
                              {cmd.icon}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{cmd.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{cmd.description}</p>
                          </div>
                          {cmd.shortcut && (
                            <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                              {cmd.shortcut}
                            </span>
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
          <div className="px-6 py-3 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground">
            <p>
              <span className="font-semibold">Shortcuts:</span> Use arrow keys to navigate, Enter to execute, Esc to close.
              Try <span className="font-mono">/block IP</span>, <span className="font-mono">/allow IP</span>, or <span className="font-mono">/query</span>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Default commands
const defaultCommands: Command[] = [
  {
    id: 'navigate-dashboard',
    name: 'Go to Dashboard',
    category: 'Navigation',
    description: 'View main dashboard',
    icon: <Shield className="w-full h-full" />,
    shortcut: 'Cmd+1',
    action: () => console.log('Navigate to dashboard'),
  },
  {
    id: 'navigate-logs',
    name: 'Go to Logs',
    category: 'Navigation',
    description: 'View firewall logs',
    icon: <AlertTriangle className="w-full h-full" />,
    shortcut: 'Cmd+2',
    action: () => console.log('Navigate to logs'),
  },
  {
    id: 'block',
    name: 'Block IP Address',
    category: 'Actions',
    description: 'Block an IP address (use /block IP)',
    icon: <Shield className="w-full h-full" />,
    action: ({ target }: any) => {
      console.log(`Blocking IP: ${target}`);
    },
  },
  {
    id: 'allow',
    name: 'Allow IP Address',
    category: 'Actions',
    description: 'Allow an IP address (use /allow IP)',
    icon: <Zap className="w-full h-full" />,
    action: ({ target }: any) => {
      console.log(`Allowing IP: ${target}`);
    },
  },
  {
    id: 'query',
    name: 'Query Logs',
    category: 'Actions',
    description: 'Search logs with AI (use /query term)',
    action: ({ target }: any) => {
      console.log(`Querying logs for: ${target}`);
    },
  },
];
