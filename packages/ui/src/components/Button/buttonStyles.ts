import { cva } from 'class-variance-authority';
import { PRESS_MOTION } from '@ValenceUI/animations/motion';

const FLAT = 'border';

const buttonStyles = cva(
  [
    'inline-flex select-none font-medium',
    'outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-0',
    'disabled:pointer-events-none disabled:opacity-50',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[1.15em]",
    PRESS_MOTION,
  ].join(' '),
  {
    variants: {
      variant: {
        primary: `${FLAT} border-white/15 bg-accent text-primary-foreground hover:bg-accent-hover`,
        glossy: `${FLAT} border-transparent bg-white text-on-white hover:bg-white-hover`,
        secondary: `${FLAT} border-[var(--surface-line)] bg-background text-secondary-foreground hover:bg-muted`,
        soft: `${FLAT} border-transparent bg-accent/15 text-accent hover:bg-accent/25`,
        ghost: 'bg-transparent text-foreground hover:bg-[var(--surface-hover)]',
        danger: `${FLAT} border-transparent bg-danger text-destructive-foreground hover:brightness-110`,
        overlay: 'bg-scrim text-on-scrim backdrop-blur-md hover:brightness-125',
        link: 'bg-transparent text-foreground underline-offset-4 hover:underline',
        bare: '',
      },
      size: {
        xs: 'h-7 gap-1.5 px-2 text-xs',
        sm: 'h-8 gap-2 px-2.5 text-[0.875rem]',
        md: 'h-9 gap-2 px-3 text-[0.875rem]',
        lg: 'h-10 gap-2 px-3.5 text-sm',
        xl: 'h-11 gap-2.5 px-5 text-base font-semibold',
        none: '',
      },
      shape: {
        square: 'rounded-md',
        pill: 'rounded-full',
        bare: '',
      },
      isIconOnly: {
        true: 'px-0',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: ['primary', 'glossy', 'secondary', 'soft', 'ghost', 'danger', 'overlay', 'link'],
        class: 'shrink-0 items-center justify-center whitespace-nowrap',
      },
      {
        variant: ['primary', 'glossy', 'secondary', 'soft', 'ghost', 'danger', 'overlay'],
        class: 'coarse:min-h-11',
      },
      { isIconOnly: true, size: 'xs', class: 'size-7 coarse:size-11' },
      { isIconOnly: true, size: 'sm', class: 'size-8 coarse:size-11' },
      { isIconOnly: true, size: 'md', class: 'size-9 coarse:size-11' },
      { isIconOnly: true, size: 'lg', class: 'size-10 coarse:size-11' },
      { isIconOnly: true, size: 'xl', class: 'size-11' },
      { variant: 'bare', class: 'shadow-none active:translate-y-0' },
      { variant: ['ghost', 'link', 'overlay'], class: 'shadow-none' },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      shape: 'square',
      isIconOnly: false,
    },
  },
);

export { buttonStyles };
