interface DiceBearAvatarProps {
  seed: string;
  size?: number;
  className?: string;
  /** ring glow color, e.g. 'var(--primary)' */
  glow?: boolean;
}

/**
 * Renders a DiceBear "bottts-neutral" robot avatar.
 * Uses the free public DiceBear API — no API key required.
 * Style chosen because robots fit the cybersecurity / firewall theme.
 */
export function DiceBearAvatar({ seed, size = 32, className = '', glow = false }: DiceBearAvatarProps) {
  const url = `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  return (
    <img
      src={url}
      alt={`Avatar for ${seed}`}
      width={size}
      height={size}
      className={`rounded-full select-none ${className}`}
      style={glow ? { boxShadow: '0 0 14px color-mix(in srgb, var(--primary) 45%, transparent)' } : undefined}
      draggable={false}
      loading="eager"
    />
  );
}
