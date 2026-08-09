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
  },
  radius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
  },
  duration: {
    fast: 0.12,
    normal: 0.22,
    slow: 0.4,
  },
} as const

type FluxTokens = typeof FLUX_TOKENS

export type { FluxTokens }

export default { FLUX_TOKENS }
