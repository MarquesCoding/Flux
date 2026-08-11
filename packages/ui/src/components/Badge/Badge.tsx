import { cn } from '@FluxUI/cn';
import type { BadgeProps, BadgeSize, BadgeTone } from './Badge.types';

const TONE_CLASSES: Record<BadgeTone, string> = {
  quiet: 'border border-white/15 bg-white/[0.06] text-text-muted backdrop-blur-md',
  accent: 'border border-accent/40 bg-accent/15 text-text backdrop-blur-md',
  solid: 'bg-black/60 text-white backdrop-blur-md',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'h-6 px-2.5 text-[0.65rem]',
  md: 'h-7 px-3 text-xs',
};

/**
 * A small fact about something.
 *
 * A pill rather than a box, uppercase and widely tracked, so a row of them
 * reads as a specification line rather than as a set of buttons. Nothing here
 * is interactive: a badge that looks pressable is a badge people press.
 */
const Badge = ({ children, tone = 'quiet', size = 'sm', className }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center justify-center rounded-full font-medium',
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
