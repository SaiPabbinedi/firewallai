import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, CheckCircle } from 'lucide-react';

interface KillChainStage {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: 'active' | 'completed' | 'blocked';
  timestamp: string;
  details?: string;
}

interface KillChainTimelineProps {
  stages?: KillChainStage[];
  onStageClick?: (stageId: string) => void;
}

export function KillChainTimeline({ 
  stages = defaultStages,
  onStageClick 
}: KillChainTimelineProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    setAnimationComplete(true);
  }, []);

  const handleStageClick = (stageId: string) => {
    setSelectedStage(stageId);
    onStageClick?.(stageId);
  };

  const getStageColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'rgba(0, 217, 255, 0.3)';
      case 'active':
        return 'rgba(251, 146, 60, 0.3)';
      case 'blocked':
        return 'rgba(255, 59, 87, 0.3)';
      default:
        return 'rgba(100, 100, 100, 0.2)';
    }
  };

  const getStageTextColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#00d9ff';
      case 'active':
        return '#fb9238';
      case 'blocked':
        return '#ff3b57';
      default:
        return '#888';
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Timeline Container */}
      <div className="relative">
        {/* Connection Line */}
        <div className="absolute top-12 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500/20 via-orange-500/20 to-red-500/20 rounded-full" />

        {/* Stages */}
        <div className="flex justify-between items-start gap-4">
          {stages.map((stage, index) => (
            <motion.div
              key={stage.id}
              className="flex-1 flex flex-col items-center cursor-pointer"
              onClick={() => handleStageClick(stage.id)}
              initial={{ opacity: 0, y: 20 }}
              animate={animationComplete ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.1, duration: 0.4 }}
            >
              {/* Stage Circle */}
              <motion.div
                className="relative w-24 h-24 rounded-full flex items-center justify-center mb-4 border-2 transition-all hover:scale-110"
                style={{
                  background: getStageColor(stage.status),
                  borderColor: getStageTextColor(stage.status),
                  boxShadow: stage.status === 'active' 
                    ? `0 0 20px ${getStageTextColor(stage.status)}` 
                    : 'none',
                }}
                animate={stage.status === 'active' ? {
                  boxShadow: [
                    `0 0 20px ${getStageTextColor(stage.status)}`,
                    `0 0 40px ${getStageTextColor(stage.status)}`,
                    `0 0 20px ${getStageTextColor(stage.status)}`,
                  ],
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="text-2xl">
                  {stage.status === 'blocked' ? (
                    <Shield className="w-8 h-8" style={{ color: getStageTextColor(stage.status) }} />
                  ) : stage.status === 'completed' ? (
                    <CheckCircle className="w-8 h-8" style={{ color: getStageTextColor(stage.status) }} />
                  ) : (
                    <AlertTriangle className="w-8 h-8" style={{ color: getStageTextColor(stage.status) }} />
                  )}
                </div>
              </motion.div>

              {/* Stage Label */}
              <h3 className="text-sm font-semibold text-center text-foreground mb-1">
                {stage.label}
              </h3>

              {/* Stage Description */}
              <p className="text-xs text-muted-foreground text-center mb-2">
                {stage.description}
              </p>

              {/* Timestamp */}
              <span 
                className="text-xs font-mono px-2 py-1 rounded"
                style={{ 
                  background: getStageColor(stage.status),
                  color: getStageTextColor(stage.status)
                }}
              >
                {stage.timestamp}
              </span>

              {/* Details (on selection) */}
              {selectedStage === stage.id && stage.details && (
                <motion.div
                  className="mt-3 p-3 rounded-lg text-xs text-foreground"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: `1px solid ${getStageTextColor(stage.status)}`,
                  }}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {stage.details}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <motion.div
        className="p-4 rounded-lg border"
        style={{
          background: 'rgba(0, 0, 0, 0.2)',
          borderColor: 'rgba(255, 59, 87, 0.3)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Kill Chain Status:</span> Attack detected and blocked at{' '}
          <span className="text-red-400 font-mono">
            {stages.find(s => s.status === 'blocked')?.label || 'Unknown Stage'}
          </span>
        </p>
      </motion.div>
    </div>
  );
}

// Default stages for demonstration
const defaultStages: KillChainStage[] = [
  {
    id: 'recon',
    label: 'Reconnaissance',
    description: 'Initial scanning',
    icon: '🔍',
    status: 'completed',
    timestamp: '14:32:01',
    details: 'Port scan detected on 192.168.1.0/24 from 203.0.113.45',
  },
  {
    id: 'weaponization',
    label: 'Weaponization',
    description: 'Exploit preparation',
    icon: '⚙️',
    status: 'completed',
    timestamp: '14:32:15',
    details: 'Malicious payload identified in HTTP request',
  },
  {
    id: 'delivery',
    label: 'Delivery',
    description: 'Payload transmission',
    icon: '📦',
    status: 'active',
    timestamp: '14:32:28',
    details: 'Suspicious file transfer attempt detected',
  },
  {
    id: 'exploitation',
    label: 'Exploitation',
    description: 'Vulnerability trigger',
    icon: '💥',
    status: 'blocked',
    timestamp: '14:32:35',
    details: 'Attack blocked by firewall rule #2847',
  },
];
