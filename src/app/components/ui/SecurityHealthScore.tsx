import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, AlertCircle, CheckCircle2, Zap, Shield } from 'lucide-react';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
}

export function SecurityHealthScore() {
  const [healthScore, setHealthScore] = useState(72);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([
    {
      id: '1',
      title: 'Update Firewall Rules',
      description: 'Consolidate 8 redundant rules for better performance',
      priority: 'high',
      impact: '+5 points',
    },
    {
      id: '2',
      title: 'Enable DPI Inspection',
      description: 'Deep packet inspection can detect advanced threats',
      priority: 'high',
      impact: '+8 points',
    },
    {
      id: '3',
      title: 'Review Access Logs',
      description: 'Analyze logs for suspicious patterns',
      priority: 'medium',
      impact: '+3 points',
    },
    {
      id: '4',
      title: 'Update Threat Database',
      description: 'Latest threat signatures are available',
      priority: 'medium',
      impact: '+4 points',
    },
  ]);

  // Simulate score fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setHealthScore(prev => {
        const change = Math.floor(Math.random() * 6) - 2;
        return Math.max(40, Math.min(95, prev + change));
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return { color: '#10b981', label: 'Excellent' };
    if (score >= 60) return { color: '#fbbf24', label: 'Good' };
    return { color: '#ff3b57', label: 'At Risk' };
  };

  const scoreInfo = getScoreColor(healthScore);
  const priorityConfig = {
    critical: { color: '#ff3b57', bg: 'rgba(255,59,87,0.1)', border: 'rgba(255,59,87,0.3)' },
    high: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
    medium: { color: '#00d9ff', bg: 'rgba(0,217,255,0.1)', border: 'rgba(0,217,255,0.3)' },
    low: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  };

  return (
    <div className="space-y-4">
      {/* Score Circle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="var(--glass-border)"
                strokeWidth="2"
              />
              {/* Progress circle */}
              <motion.circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={scoreInfo.color}
                strokeWidth="3"
                strokeDasharray={`${(healthScore / 100) * 282.7} 282.7`}
                animate={{ strokeDasharray: `${(healthScore / 100) * 282.7} 282.7` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <motion.div
                  className="text-2xl font-bold"
                  style={{ color: scoreInfo.color }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {healthScore}
                </motion.div>
                <div className="text-[10px] text-muted-foreground">Score</div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Network Health</p>
              <p className="text-lg font-semibold" style={{ color: scoreInfo.color }}>
                {scoreInfo.label}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" style={{ color: scoreInfo.color }} />
              <span>+2 points this week</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">AI Recommendations</h3>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
          {recommendations.map((rec) => {
            const config = priorityConfig[rec.priority];
            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-lg border transition-all hover:border-primary/50"
                style={{
                  background: config.bg,
                  border: `1px solid ${config.border}`,
                }}
              >
                <div className="flex items-start gap-2.5">
                  <Shield className="h-4 w-4 mt-0.5 shrink-0" style={{ color: config.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-foreground">{rec.title}</p>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 uppercase"
                        style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
                      >
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                    <p className="text-[10px] font-semibold mt-1.5" style={{ color: config.color }}>
                      {rec.impact}
                    </p>
                  </div>
                  <button className="shrink-0 ml-2 p-1.5 rounded hover:bg-muted/50 transition-colors">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground hover:text-primary" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
