import { cn } from '@FluxUI/cn';

const POPUP_MOTION = cn(
  'origin-[var(--transform-origin)] transition-[transform,opacity] duration-[var(--duration-base)] ease-[var(--ease-soft)]',
  'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
  'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
);

export { POPUP_MOTION };
