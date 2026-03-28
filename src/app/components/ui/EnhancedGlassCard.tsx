import { useState } from 'react';
import { motion } from 'framer-motion';

interface EnhancedGlassCardProps {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  layoutId?: string;
  variant?: 'default' | 'accent' | 'danger' | 'success';
  interactive?: boolean;
  glow?: boolean;
}

const variantConfig = {
  default: {
    borderGradient: 'linear-gradient(135deg, rgba(0,217,255,0.3), rgba(139,92,246,0.1))',
    glowColor: 'rgba(0,217,255,0.2)',
  },
  accent: {
    borderGradient: 'linear-gradient(135deg, rgba(0,217,255,0.4), rgba(0,217,255,0.2))',
    glowColor: 'rgba(0,217,255,0.3)',
  },
  danger: {
    borderGradient: 'linear-gradient(135deg, rgba(255,59,87,0.3), rgba(255,59,87,0.1))',
    glowColor: 'rgba(255,59,87,0.2)',
  },
  success: {
    borderGradient: 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(16,185,129,0.1))',
    glowColor: 'rgba(16,185,129,0.2)',
  },
};

const card = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' as const } },
};

export function EnhancedGlassCard({
  className = '',
  style = {},
  children,
  layoutId,
  variant = 'default',
  interactive = true,
  glow = false,
}: EnhancedGlassCardProps) {
  const [hovered, setHovered] = useState(false);
  const config = variantConfig[variant];

  return (
    <motion.div
      layoutId={layoutId}
      variants={card}
      whileHover={interactive ? { y: -2, transition: { duration: 0.15 } } : {}}
      className={`rounded-xl p-5 transition-all duration-300 relative overflow-hidden ${className}`}
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--glass-border)',
        boxShadow: hovered && glow
          ? `0 0 20px ${config.glowColor}, 0 4px 24px var(--glass-shadow)`
          : '0 4px 24px var(--glass-shadow)',
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Gradient border effect */}
      {glow && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none opacity-0 transition-opacity duration-300"
          style={{
            background: config.borderGradient,
            padding: '1px',
            opacity: hovered ? 0.5 : 0,
          }}
        />
      )}

      {/* Mesh gradient background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          background: `radial-gradient(circle at 20% 50%, rgba(0,217,255,0.3) 0%, transparent 50%),
                        radial-gradient(circle at 80% 80%, rgba(139,92,246,0.3) 0%, transparent 50%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}
