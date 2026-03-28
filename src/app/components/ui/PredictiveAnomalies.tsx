import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, TrendingUp, Eye, EyeOff } from 'lucide-react';

interface AnomalyPattern {
  id: string;
  sourceIP: string;
  targetIP: string;
  protocol: string;
  pattern: string;
  confidence: number; // 0-100
  riskScore: number; // 0-100
  historicalFrequency: number;
  currentFrequency: number;
  deviation: number; // percentage
  firstSeen: string;
  lastSeen: string;
  description: string;
}

interface PredictiveAnomaliesProps {
  anomalies?: AnomalyPattern[];
  onInvestigate?: (anomalyId: string) => void;
  onBlock?: (sourceIP: string) => void;
  onDismiss?: (anomalyId: string) => void;
}

export function PredictiveAnomalies({
  anomalies = defaultAnomalies,
  onInvestigate,
  onBlock,
  onDismiss,
}: PredictiveAnomaliesProps) {
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set());
  const [selectedAnomaly, setSelectedAnomaly] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'risk' | 'confidence' | 'deviation'>('risk');

  const visibleAnomalies = anomalies.filter(a => !dismissedAnomalies.has(a.id));

  const sortedAnomalies = [...visibleAnomalies].sort((a, b) => {
    switch (sortBy) {
      case 'risk':
        return b.riskScore - a.riskScore;
      case 'confidence':
        return b.confidence - a.confidence;
      case 'deviation':
        return b.deviation - a.deviation;
      default:
        return 0;
    }
  });

  const handleDismiss = (anomalyId: string) => {
    const newDismissed = new Set(dismissedAnomalies);
    newDismissed.add(anomalyId);
    setDismissedAnomalies(newDismissed);
    onDismiss?.(anomalyId);
  };

  const getRiskColor = (score: number) => {
    if (score >= 75) return '#ff3b57'; // Critical
    if (score >= 50) return '#fbbf24'; // High
    if (score >= 25) return '#fb9238'; // Medium
    return '#00d9ff'; // Low
  };

  const getRiskLabel = (score: number) => {
    if (score >= 75) return 'Critical';
    if (score >= 50) return 'High';
    if (score >= 25) return 'Medium';
    return 'Low';
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
          <h3 className="text-sm font-semibold text-foreground">
            Predicted Threats
          </h3>
          <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 font-mono">
            {visibleAnomalies.length}
          </span>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs bg-muted border border-border rounded px-2 py-1 text-foreground"
          >
            <option value="risk">Risk Score</option>
            <option value="confidence">Confidence</option>
            <option value="deviation">Deviation</option>
          </select>
        </div>
      </div>

      {/* Anomalies List */}
      <AnimatePresence mode="popLayout">
        {sortedAnomalies.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center py-8 text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Eye className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No predicted anomalies detected</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {sortedAnomalies.map((anomaly) => (
              <motion.div
                key={anomaly.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="group"
              >
                <motion.div
                  onClick={() => setSelectedAnomaly(
                    selectedAnomaly === anomaly.id ? null : anomaly.id
                  )}
                  className="p-3 rounded-lg border cursor-pointer transition-all hover:border-opacity-100"
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderColor: getRiskColor(anomaly.riskScore) + '40',
                    borderWidth: '1px',
                  }}
                  whileHover={{
                    borderColor: getRiskColor(anomaly.riskScore) + '80',
                  }}
                >
                  {/* Main Row */}
                  <div className="flex items-start justify-between gap-3">
                    {/* Left Section */}
                    <div className="flex-1 min-w-0">
                      {/* Risk Badge and IP */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs font-bold px-2 py-1 rounded-full"
                          style={{
                            background: getRiskColor(anomaly.riskScore) + '30',
                            color: getRiskColor(anomaly.riskScore),
                          }}
                        >
                          {getRiskLabel(anomaly.riskScore)}
                        </span>
                        <span className="text-xs font-mono text-foreground">
                          {anomaly.sourceIP} → {anomaly.targetIP}
                        </span>
                      </div>

                      {/* Pattern Description */}
                      <p className="text-xs text-muted-foreground mb-2">
                        {anomaly.description}
                      </p>

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Confidence:</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                className="h-full"
                                style={{ background: '#00d9ff' }}
                                initial={{ width: 0 }}
                                animate={{ width: `${anomaly.confidence}%` }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                            <span className="font-mono text-foreground w-8 text-right">
                              {anomaly.confidence}%
                            </span>
                          </div>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Risk Score:</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                className="h-full"
                                style={{ background: getRiskColor(anomaly.riskScore) }}
                                initial={{ width: 0 }}
                                animate={{ width: `${anomaly.riskScore}%` }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                            <span className="font-mono text-foreground w-8 text-right">
                              {anomaly.riskScore}
                            </span>
                          </div>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Deviation:</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <TrendingUp className="w-3 h-3 text-orange-400" />
                            <span className="font-mono text-orange-400">
                              +{anomaly.deviation}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Section - Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInvestigate?.(anomaly.id);
                        }}
                        className="p-1.5 rounded-md border border-border hover:bg-muted transition-all"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="Investigate"
                      >
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </motion.button>

                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          onBlock?.(anomaly.sourceIP);
                        }}
                        className="p-1.5 rounded-md border border-border hover:bg-red-500/10 transition-all"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="Block IP"
                      >
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      </motion.button>

                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismiss(anomaly.id);
                        }}
                        className="p-1.5 rounded-md border border-border hover:bg-muted transition-all"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="Dismiss"
                      >
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {selectedAnomaly === anomaly.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-3 pt-3 border-t border-border/50"
                      >
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-muted-foreground">Protocol:</span>
                              <p className="font-mono text-foreground">{anomaly.protocol}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Pattern:</span>
                              <p className="font-mono text-foreground">{anomaly.pattern}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Historical Freq:</span>
                              <p className="font-mono text-foreground">
                                {anomaly.historicalFrequency}/min
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Current Freq:</span>
                              <p className="font-mono text-orange-400">
                                {anomaly.currentFrequency}/min
                              </p>
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Timeline:</span>
                            <p className="font-mono text-foreground">
                              {anomaly.firstSeen} → {anomaly.lastSeen}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Default anomalies for demonstration
const defaultAnomalies: AnomalyPattern[] = [
  {
    id: 'anom-1',
    sourceIP: '203.0.113.45',
    targetIP: '192.168.1.50',
    protocol: 'TCP',
    pattern: 'Port scanning sequence',
    confidence: 92,
    riskScore: 85,
    historicalFrequency: 2,
    currentFrequency: 47,
    deviation: 2250,
    firstSeen: '14:32:01',
    lastSeen: '14:35:22',
    description: 'Unusual port scanning activity detected from external IP',
  },
  {
    id: 'anom-2',
    sourceIP: '192.168.1.75',
    targetIP: '8.8.8.8',
    protocol: 'DNS',
    pattern: 'DNS exfiltration',
    confidence: 78,
    riskScore: 68,
    historicalFrequency: 5,
    currentFrequency: 156,
    deviation: 3020,
    firstSeen: '14:33:15',
    lastSeen: '14:36:45',
    description: 'Abnormal DNS query volume from internal host',
  },
  {
    id: 'anom-3',
    sourceIP: '10.0.1.15',
    targetIP: '192.168.1.100',
    protocol: 'HTTP',
    pattern: 'Brute force attempt',
    confidence: 85,
    riskScore: 72,
    historicalFrequency: 1,
    currentFrequency: 89,
    deviation: 8800,
    firstSeen: '14:34:20',
    lastSeen: '14:37:10',
    description: 'Multiple failed authentication attempts detected',
  },
];
