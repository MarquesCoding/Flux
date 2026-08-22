const UNDERLINED = {
  track:
    'valence-rail relative flex items-center gap-6 overflow-x-auto border-b border-[var(--surface-line)]',
  item: [
    'relative flex shrink-0 cursor-pointer items-center rounded-sm outline-none',
    'transition-colors duration-[var(--duration-instant)] ease-[var(--ease-out)]',
    'motion-reduce:transition-none',
    'text-text-muted hover:text-text focus-visible:text-text',
    'focus-visible:ring-[3px] focus-visible:ring-ring',
  ].join(' '),
  itemSizes: {
    sm: 'h-9 text-[0.8125rem]',
    md: 'h-11 text-sm',
  },
  chosen: 'font-semibold text-text',
  mark: 'inset-x-0 bottom-0 top-auto z-0 h-[2px] rounded-none bg-text',
} as const;

export { UNDERLINED };
