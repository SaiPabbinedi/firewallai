import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  sourceIP?: string;
  destIP?: string;
  port?: number;
  protocol?: string;
}

interface VirtualLogScrollerProps {
  logs: LogEntry[];
  itemHeight?: number;
  containerHeight?: number;
  onLogClick?: (log: LogEntry) => void;
  renderLog?: (log: LogEntry) => React.ReactNode;
}

export function VirtualLogScroller({
  logs,
  itemHeight = 60,
  containerHeight = 600,
  onLogClick,
  renderLog,
}: VirtualLogScrollerProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Calculate visible range
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 1, logs.length);

  // Memoize visible logs
  const visibleLogs = useMemo(() => {
    return logs.slice(startIndex, endIndex).map((log, idx) => ({
      log,
      index: startIndex + idx,
    }));
  }, [logs, startIndex, endIndex]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce scroll end detection
    scrollTimeoutRef.current = setTimeout(() => {
      // Scroll ended
    }, 150);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return '#ff3b57';
      case 'warning':
        return '#fbbf24';
      case 'debug':
        return '#a78bfa';
      default:
        return '#00d9ff';
    }
  };

  const getLevelLabel = (level: string) => {
    return level.toUpperCase();
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="relative overflow-y-auto custom-scrollbar"
      style={{
        height: containerHeight,
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '0.75rem',
      }}
    >
      {/* Virtual spacer for items before visible range */}
      <div style={{ height: startIndex * itemHeight }} />

      {/* Visible logs */}
      <div className="space-y-1 px-2">
        {visibleLogs.map(({ log, index }) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => onLogClick?.(log)}
            className="cursor-pointer group"
          >
            {renderLog ? (
              renderLog(log)
            ) : (
              <DefaultLogRow log={log} levelColor={getLevelColor(log.level)} />
            )}
          </motion.div>
        ))}
      </div>

      {/* Virtual spacer for items after visible range */}
      <div style={{ height: Math.max(0, (logs.length - endIndex) * itemHeight) }} />

      {/* Empty state */}
      {logs.length === 0 && (
        <motion.div
          className="flex flex-col items-center justify-center h-full text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-sm">No logs to display</p>
        </motion.div>
      )}

      {/* Scroll indicator */}
      <motion.div
        className="fixed right-2 top-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {startIndex + 1} - {Math.min(endIndex, logs.length)} of {logs.length}
      </motion.div>
    </div>
  );
}

// Default log row renderer
function DefaultLogRow({
  log,
  levelColor,
}: {
  log: LogEntry;
  levelColor: string;
}) {
  return (
    <div
      className="p-2 rounded-lg border transition-all hover:border-opacity-100 hover:bg-muted/50"
      style={{
        background: 'rgba(0, 0, 0, 0.15)',
        borderColor: levelColor + '40',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{
                background: levelColor + '20',
                color: levelColor,
              }}
            >
              {log.level.toUpperCase()}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {log.timestamp}
            </span>
          </div>
          <p className="text-xs text-foreground break-words">{log.message}</p>
          {(log.sourceIP || log.destIP) && (
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              {log.sourceIP && (
                <p>
                  From: <span className="font-mono text-foreground">{log.sourceIP}</span>
                </p>
              )}
              {log.destIP && (
                <p>
                  To: <span className="font-mono text-foreground">{log.destIP}</span>
                  {log.port && <span className="ml-1">:{log.port}</span>}
                </p>
              )}
              {log.protocol && (
                <p>
                  Protocol: <span className="font-mono text-foreground">{log.protocol}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook for managing virtual log list
export function useVirtualLogs(logs: LogEntry[], pageSize: number = 50) {
  const [page, setPage] = useState(0);

  const paginatedLogs = useMemo(() => {
    return logs.slice(page * pageSize, (page + 1) * pageSize);
  }, [logs, page, pageSize]);

  const totalPages = Math.ceil(logs.length / pageSize);

  const goToPage = (newPage: number) => {
    setPage(Math.max(0, Math.min(newPage, totalPages - 1)));
  };

  return {
    paginatedLogs,
    page,
    totalPages,
    goToPage,
    hasNextPage: page < totalPages - 1,
    hasPrevPage: page > 0,
  };
}

// Performance optimization: Memoized log row
export const MemoizedLogRow = React.memo(DefaultLogRow);

// Re-export React for memoization
import React from 'react';
