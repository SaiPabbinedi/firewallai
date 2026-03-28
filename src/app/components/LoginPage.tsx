import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, User, Lock, AlertCircle, Eye, EyeOff, Zap, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onLogin: (username: string, password: string) => void;
  error: string;
}

// Beam effect component
const BeamEffect = () => {
  const beamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!beamRef.current) return;
      const rect = beamRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      beamRef.current.style.setProperty('--mouse-x', `${x}px`);
      beamRef.current.style.setProperty('--mouse-y', `${y}px`);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={beamRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        background: `radial-gradient(600px at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(0, 255, 255, 0.1), transparent 80%)`,
      } as any}
    />
  );
};

// Animated background grid
const BackgroundGrid = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    <motion.div
      className="absolute inset-0"
      style={{
        backgroundImage: `
          linear-gradient(rgba(0, 255, 255, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 255, 255, 0.05) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }}
      animate={{
        backgroundPosition: ['0px 0px', '60px 60px'],
      }}
      transition={{
        duration: 20,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  </div>
);

// Floating particles
const FloatingParticles = () => {
  const particles = Array.from({ length: 20 }, (_, i) => i);

  return (
    <div className="fixed inset-0 pointer-events-none">
      {particles.map((i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-cyan-400/30"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            opacity: 0,
          }}
          animate={{
            y: [0, -100, 0],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );
};

export function LoginPage({ onLogin, error }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      onLogin(username, password);
      setIsLoading(false);
    }, 900);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  };

  return (
    <div
      className="h-screen w-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'var(--background)' }}
    >
      {/* Background effects */}
      <BackgroundGrid />
      <BeamEffect />
      <FloatingParticles />

      {/* Gradient orbs */}
      <motion.div
        className="fixed -top-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)',
        }}
        animate={{
          y: [0, 50, 0],
          x: [0, 30, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="fixed -bottom-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)',
        }}
        animate={{
          y: [0, -50, 0],
          x: [0, -30, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Main content */}
      <motion.div
        className="w-full max-w-md relative z-10 flex flex-col max-h-screen overflow-y-auto justify-center py-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Logo */}
        <motion.div className="flex flex-col items-center mb-4" variants={itemVariants}>
          <motion.div
            className="relative mb-3"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            {/* Animated outer ring */}
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'conic-gradient(from 0deg, rgba(0, 255, 255, 0.4), rgba(0, 255, 255, 0.1), rgba(0, 255, 255, 0.4))',
              }}
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: 'linear',
              }}
            />

            {/* Modern tech logo container */}
            <div className="relative w-16 h-16 rounded-2xl border-2 border-cyan-400/40 flex items-center justify-center backdrop-blur-2xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 shadow-lg shadow-cyan-500/20">
              <motion.svg
                className="w-8 h-8"
                viewBox="0 0 100 100"
                animate={{
                  scale: [1, 1.08, 1],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                {/* Modern shield design */}
                <path
                  d="M50 15 L75 28 L75 55 Q75 72 50 82 Q25 72 25 55 L25 28 Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-cyan-400"
                />
                {/* Lock symbol */}
                <circle cx="50" cy="50" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400" />
                <path
                  d="M46 46 L46 40 Q46 37 50 37 Q54 37 54 40 L54 46"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-cyan-400"
                />
              </motion.svg>
            </div>
          </motion.div>

          <motion.h1
            className="text-4xl font-black text-white tracking-tight text-center mt-2"
            variants={itemVariants}
          >
            FirewallAI
          </motion.h1>
          <motion.p
            className="text-cyan-400/70 text-xs font-medium mt-1 tracking-widest uppercase"
            variants={itemVariants}
          >
            Modern Firewall Architectures
          </motion.p>
        </motion.div>

        {/* Login card */}
        <motion.div
          variants={itemVariants}
          className="relative mt-2"
        >
          <div
            className="relative rounded-2xl p-6 backdrop-blur-2xl border border-cyan-500/20"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 30, 40, 0.8) 0%, rgba(0, 50, 60, 0.6) 100%)',
            }}
          >
            <motion.div variants={itemVariants}>
              <h2 className="text-xl font-bold text-white mb-1">Welcome Back</h2>
              <p className="text-cyan-400/60 text-xs mb-5">Access your security dashboard</p>

              {/* Error alert */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{error}</p>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Username field */}
                <motion.div variants={itemVariants} className="relative">
                  <label className="block text-xs font-semibold text-white mb-1.5">Username</label>
                  <div className="relative group/input">
                    <motion.div
                      className="absolute inset-0 rounded-lg opacity-0 group-hover/input:opacity-100 transition-opacity"
                      style={{
                        background: 'radial-gradient(circle at center, rgba(0, 255, 255, 0.1), transparent)',
                      }}
                    />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                    placeholder="admin"
                    className="w-full px-3 py-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-white placeholder-cyan-400/40 focus:outline-none focus:border-cyan-400/50 transition-all backdrop-blur-xl text-sm"
                  />
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400/50 pointer-events-none" />
                  </div>
                </motion.div>

                {/* Password field */}
                <motion.div variants={itemVariants} className="relative">
                  <label className="block text-xs font-semibold text-white mb-1.5">Password</label>
                  <div className="relative group/input">
                    <motion.div
                      className="absolute inset-0 rounded-lg opacity-0 group-hover/input:opacity-100 transition-opacity"
                      style={{
                        background: 'radial-gradient(circle at center, rgba(0, 255, 255, 0.1), transparent)',
                      }}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="••••••••••"
                      className="w-full px-3 py-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-white placeholder-cyan-400/40 focus:outline-none focus:border-cyan-400/50 transition-all backdrop-blur-xl text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400/50 hover:text-cyan-400 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </motion.div>

                {/* Sign in button */}
                <motion.button
                  type="submit"
                  disabled={isLoading || !username || !password}
                  className="w-full mt-4 py-2.5 rounded-lg font-bold text-black text-sm relative overflow-hidden group/btn disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,255,255,0.3)]"
                  style={{
                    background: 'linear-gradient(90deg, #00ffff, #00ccff)',
                  }}
                  whileHover={{ scale: 1.02, shadow: '0_0_30px_rgba(0,255,255,0.5)' }}
                  whileTap={{ scale: 0.98 }}
                  variants={itemVariants}
                >
                  {/* Animated shine effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{
                      x: ['-100%', '100%'],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />

                  <div className="relative flex items-center justify-center gap-2">
                    {isLoading ? (
                      <>
                        <motion.div
                          className="w-4 h-4 rounded-full border-2 border-black border-t-transparent"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                        <span>Signing in…</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <motion.div
                          animate={{ x: [0, 4, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </motion.div>
                      </>
                    )}
                  </div>
                </motion.button>
              </form>
            </motion.div>

            {/* Demo credentials */}
            <motion.div
              className="mt-4 p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5"
              variants={itemVariants}
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-3 h-3 text-cyan-400" />
                <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Demo Credentials</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <p className="text-cyan-400/60 text-[10px]">Username</p>
                  <p className="text-cyan-300 font-mono font-bold text-xs">admin</p>
                </div>
                <div>
                  <p className="text-cyan-400/60 text-[10px]">Password</p>
                  <p className="text-cyan-300 font-mono font-bold text-xs">firewall123</p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          className="text-center text-[10px] text-cyan-400/40 mt-3"
          variants={itemVariants}
        >
          FirewallAI v1.1 · pfSense 2.7+
        </motion.p>
      </motion.div>
    </div>
  );
}
