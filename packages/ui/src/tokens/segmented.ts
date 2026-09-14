const SEGMENTED = {
  track:
    'valence-rail relative flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-md',
  trackSizes: {
    sm: 'p-[3px]',
    md: 'p-1.5',
  },
  item: [
    'relative flex shrink-0 cursor-pointer items-center rounded-md outline-none',
    'transition-colors duration-[var(--duration-instant)] ease-[var(--ease-out)]',
    'motion-reduce:transition-none',
    'text-text-muted hover:text-text focus-visible:text-text',
    'focus-visible:ring-[3px] focus-visible:ring-ring',
  ].join(' '),
  itemSizes: {
    sm: 'h-[26px] px-3 text-[0.8125rem] font-medium',
    md: 'h-9 px-4 text-sm',
  },
  tones: {
    inverted: {
      track: 'border border-[var(--surface-line)] bg-[var(--surface-hover)]',
      mark: 'rounded-md bg-text',
      chosen: 'font-semibold text-surface hover:text-surface focus-visible:text-surface',
    },
    accent: {
      track: 'border border-[var(--surface-line)] bg-[var(--surface-hover)]',
      mark: 'rounded-md border border-[var(--surface-line)] bg-[var(--surface-active)]',
      chosen: 'font-semibold text-text hover:text-text focus-visible:text-text',
    },
  },
} as const;

export { SEGMENTED };
