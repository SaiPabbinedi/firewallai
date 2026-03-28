import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, MessageCircle, Loader2 } from 'lucide-react';

interface ContextualActionProps {
  content: string;
  type: 'rule' | 'log' | 'threat';
  onExplain?: (content: string, context: string) => void;
  onBlock?: (target: string) => void;
  onAnalyze?: (content: string) => void;
}

export function AIContextualActions({
  content,
  type,
  onExplain,
  onBlock,
  onAnalyze,
}: ContextualActionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleExplain = async () => {
    setIsLoading(true);
    try {
      onExplain?.(content, type);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      onAnalyze?.(content);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionLabel = () => {
    switch (type) {
      case 'rule':
        return 'Explain Rule';
      case 'log':
        return 'Analyze Log';
      case 'threat':
        return 'Investigate Threat';
      default:
        return 'Get Insights';
    }
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      {/* Explain Button */}
      <motion.button
        onClick={handleExplain}
        disabled={isLoading}
        className="p-1.5 rounded-md border border-border hover:bg-muted transition-all disabled:opacity-50"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        title={getActionLabel()}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : (
          <MessageCircle className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
        )}
      </motion.button>

      {/* Analyze Button (for logs and threats) */}
      {(type === 'log' || type === 'threat') && (
        <motion.button
          onClick={handleAnalyze}
          disabled={isLoading}
          className="p-1.5 rounded-md border border-border hover:bg-muted transition-all disabled:opacity-50"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Analyze with AI"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          ) : (
            <Zap className="w-4 h-4 text-muted-foreground hover:text-yellow-400 transition-colors" />
          )}
        </motion.button>
      )}

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded text-xs text-foreground whitespace-nowrap"
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              border: '1px solid rgba(0, 217, 255, 0.3)',
            }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
          >
            {getActionLabel()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Integration helper for log entries
export function LogEntryWithAI({
  log,
  onExplain,
}: {
  log: {
    id: string;
    timestamp: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
    sourceIP?: string;
    targetIP?: string;
  };
  onExplain?: (content: string, context: string) => void;
}) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return '#ff3b57';
      case 'warning':
        return '#fbbf24';
      default:
        return '#00d9ff';
    }
  };

  return (
    <div
      className="flex items-start justify-between gap-3 p-3 rounded-lg border"
      style={{
        background: 'rgba(0, 0, 0, 0.2)',
        borderColor: getSeverityColor(log.severity) + '40',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded"
            style={{
              background: getSeverityColor(log.severity) + '20',
              color: getSeverityColor(log.severity),
            }}
          >
            {log.severity.toUpperCase()}
          </span>
          <span className="text-xs text-muted-foreground">{log.timestamp}</span>
        </div>
        <p className="text-sm text-foreground break-words">{log.message}</p>
        {(log.sourceIP || log.targetIP) && (
          <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
            {log.sourceIP && <p>From: <span className="font-mono">{log.sourceIP}</span></p>}
            {log.targetIP && <p>To: <span className="font-mono">{log.targetIP}</span></p>}
          </div>
        )}
      </div>

      {/* AI Actions */}
      <div className="shrink-0">
        <AIContextualActions
          content={log.message}
          type="log"
          onExplain={onExplain}
        />
      </div>
    </div>
  );
}

// Integration helper for firewall rules
export function FirewallRuleWithAI({
  rule,
  onExplain,
}: {
  rule: {
    id: string;
    name: string;
    action: 'allow' | 'block' | 'log';
    protocol: string;
    sourceIP: string;
    destIP: string;
    port: string;
    description?: string;
  };
  onExplain?: (content: string, context: string) => void;
}) {
  const getActionColor = (action: string) => {
    switch (action) {
      case 'allow':
        return '#00d9ff';
      case 'block':
        return '#ff3b57';
      default:
        return '#fbbf24';
    }
  };

  const ruleContent = `${rule.action.toUpperCase()} ${rule.protocol} from ${rule.sourceIP} to ${rule.destIP}:${rule.port}`;

  return (
    <div
      className="flex items-start justify-between gap-3 p-3 rounded-lg border"
      style={{
        background: 'rgba(0, 0, 0, 0.2)',
        borderColor: getActionColor(rule.action) + '40',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded"
            style={{
              background: getActionColor(rule.action) + '20',
              color: getActionColor(rule.action),
            }}
          >
            {rule.action.toUpperCase()}
          </span>
          <span className="text-sm font-semibold text-foreground">{rule.name}</span>
        </div>
        <p className="text-xs text-muted-foreground font-mono mb-1">{ruleContent}</p>
        {rule.description && (
          <p className="text-xs text-foreground">{rule.description}</p>
        )}
      </div>

      {/* AI Actions */}
      <div className="shrink-0">
        <AIContextualActions
          content={ruleContent}
          type="rule"
          onExplain={onExplain}
        />
      </div>
    </div>
  );
}
