import { cva } from 'class-variance-authority';
import { PRESS_MOTION } from '@ValenceUI/animations/motion';

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
        primary: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        glossy:
          'valence-gloss bg-white text-black shadow-xs hover:brightness-105 hover:shadow-[0_10px_30px_-6px_rgba(255,255,255,0.35)]',
        secondary:
          'border border-[var(--surface-line)] bg-secondary text-secondary-foreground shadow-xs hover:bg-[var(--surface-hover)]',
        soft: 'border border-accent/30 bg-accent/15 text-accent hover:bg-accent/25',
        ghost: 'bg-transparent text-foreground hover:bg-[var(--surface-hover)]',
        danger: 'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
        overlay: 'bg-scrim text-on-scrim backdrop-blur-md hover:brightness-125',
        link: 'bg-transparent text-foreground underline-offset-4 hover:underline',
        bare: '',
      },
      size: {
        sm: 'h-8 gap-1.5 px-3.5 text-[0.8125rem]',
        md: 'h-9 gap-2 px-3.5 text-sm',
        lg: 'h-10 gap-2 px-5 text-sm',
        xl: 'h-12 gap-2.5 px-6 text-base font-semibold',
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
      { isIconOnly: true, size: 'sm', class: 'size-8' },
      { isIconOnly: true, size: 'md', class: 'size-9' },
      { isIconOnly: true, size: 'lg', class: 'size-10' },
      { isIconOnly: true, size: 'xl', class: 'size-12' },
      { variant: 'bare', class: 'shadow-none active:scale-100' },
      { shape: 'pill', isIconOnly: false, class: 'rounded-md' },
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
