const SURFACE_MOTION =
  'transition-[opacity,transform] duration-[var(--duration-base)] ease-[var(--ease-out)] motion-reduce:transition-none';

const OVERLAY_MOTION =
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-[var(--duration-base)] ease-[var(--ease-out)] motion-reduce:animate-none';

const POPUP_MOTION =
  'origin-[var(--radix-popper-transform-origin,var(--transform-origin,center))] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-[var(--duration-fast)] ease-[var(--ease-out)] motion-reduce:animate-none';

const PANEL_MOTION =
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-98 data-[state=closed]:zoom-out-98 data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-bottom-2 duration-[var(--duration-base)] ease-[var(--ease-out)] motion-reduce:animate-none';

const PRESS_MOTION =
  'transition-[transform,filter,background-color,border-color,color,box-shadow] duration-[var(--duration-instant)] ease-[var(--ease-out)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100';

export { SURFACE_MOTION, OVERLAY_MOTION, POPUP_MOTION, PANEL_MOTION, PRESS_MOTION };
