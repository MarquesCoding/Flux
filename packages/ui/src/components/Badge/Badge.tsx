import { cn } from '@FluxUI/cn';
import type { BadgeProps, BadgeSize, BadgeTone } from './Badge.types';

const TONE_CLASSES: Record<BadgeTone, string> = {
  quiet: 'border border-white/15 bg-white/[0.06] text-text-muted backdrop-blur-md',
  accent: 'border border-accent/40 bg-accent/15 text-text backdrop-blur-md',
  solid: 'bg-black/60 text-white backdrop-blur-md',
  warning: 'border border-amber-400/50 bg-amber-400/15 text-text backdrop-blur-md',
  danger: 'border border-danger/50 bg-danger/15 text-text backdrop-blur-md',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'h-6 px-2.5 text-[0.65rem]',
  md: 'h-7 px-3 text-xs',
};

/**
 * States one small fact beside the thing it is about — a count, a status, a format. Sized to sit
 * inline without disturbing the line it is on, and toned so that the ordinary case is quiet and
 * only a warning or a failure asks for attention.
 *
 * @param children - The fact, in as few words as it can be said.
 * @param tone - How much attention it should draw, defaulting to none.
 * @param size - Whether it sits inline with text or stands slightly apart.
 * @param className - Extra classes for the caller's own layout.
 */
const Badge = ({ children, tone = 'quiet', size = 'sm', className }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium',
      'uppercase tracking-[0.12em] indent-[0.12em] leading-none whitespace-nowrap',
      TONE_CLASSES[tone],
      SIZE_CLASSES[size],
      className,
    )}
  >
    {children}
  </span>
);

Badge.displayName = 'Badge';

export { Badge };
