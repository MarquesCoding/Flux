const FLUX_EASE = {
  soft: [0.22, 1, 0.36, 1],
  spring: [0.34, 1.4, 0.64, 1],
} as const;

const FLUX_TOKENS = {
  color: {
    surface: 'var(--color-surface)',
    surfaceRaised: 'var(--color-surface-raised)',
    border: 'var(--color-border)',
    text: 'var(--color-text)',
    textMuted: 'var(--color-text-muted)',
    accent: 'var(--color-accent)',
    accentContrast: 'var(--color-accent-contrast)',
    danger: 'var(--color-danger)',
    scrim: 'var(--color-scrim)',
    onScrim: 'var(--color-on-scrim)',
  },
  radius: {
    xs: 'var(--radius-xs)',
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
    xxl: 'var(--radius-2xl)',
    pill: 'var(--radius-pill)',
  },
  shadow: {
    raised: 'var(--shadow-raised)',
    lifted: 'var(--shadow-lifted)',
    overlay: 'var(--shadow-overlay)',
  },
  duration: {
    fast: 0.12,
    normal: 0.22,
    slow: 0.38,
  },
  ease: FLUX_EASE,
} as const;

type FluxTokens = typeof FLUX_TOKENS;

export type { FluxTokens };

export { FLUX_EASE, FLUX_TOKENS };
