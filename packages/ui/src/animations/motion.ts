const LEAVES_FASTER = 'data-[state=closed]:duration-[var(--duration-leaving)]';

const SURFACE_MOTION = [
  'transition-[opacity,transform] duration-[var(--duration-base)] ease-[var(--ease-out)]',
  'motion-reduce:transition-none',
].join(' ');

const OVERLAY_MOTION = [
  'data-[state=open]:animate-in data-[state=closed]:animate-out',
  'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
  'duration-[var(--duration-base)] ease-[var(--ease-out)]',
  LEAVES_FASTER,
  'motion-reduce:duration-[var(--duration-instant)]',
].join(' ');

const POPUP_MOTION = [
  'origin-[var(--radix-popper-transform-origin,var(--transform-origin,center))]',
  'data-[state=open]:animate-in data-[state=closed]:animate-out',
  'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
  'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
  'duration-[var(--duration-fast)] ease-[var(--ease-out)]',
  LEAVES_FASTER,
  'motion-reduce:duration-[var(--duration-instant)]',
].join(' ');

const PANEL_MOTION = [
  'data-[state=open]:animate-in data-[state=closed]:animate-out',
  'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
  'data-[state=open]:zoom-in-98 data-[state=closed]:zoom-out-98',
  'data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-bottom-2',
  'duration-[var(--duration-base)] ease-[var(--ease-out)]',
  LEAVES_FASTER,
  'motion-reduce:duration-[var(--duration-instant)]',
].join(' ');

const PRESS_MOTION = [
  'transition-[transform,background-color,border-color,color,box-shadow,filter]',
  'duration-[var(--duration-instant)] ease-[var(--ease-out)]',
  'active:translate-y-px',
  'motion-reduce:transition-none motion-reduce:active:translate-y-0',
].join(' ');

const HOVER_LIFT = [
  'transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)]',
  'motion-reduce:transition-none',
  'hover-hover:hover:-translate-y-1',
].join(' ');

export { SURFACE_MOTION, OVERLAY_MOTION, POPUP_MOTION, PANEL_MOTION, PRESS_MOTION, HOVER_LIFT };
