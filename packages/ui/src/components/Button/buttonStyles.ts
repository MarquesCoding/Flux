import { cva } from 'class-variance-authority';
import { PRESS_MOTION } from '@ValenceUI/animations/motion';

const RAISED = 'valence-raise';

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
        primary: `${RAISED} valence-raise--tinted [--raise-fill:var(--color-accent)] text-primary-foreground`,
        glossy: `${RAISED} valence-raise--pale text-black`,
        secondary: `${RAISED} text-secondary-foreground`,
        soft: `${RAISED} valence-raise--tinted [--raise-fill:color-mix(in_oklab,var(--color-accent)_28%,var(--color-surface-raised))] text-accent`,
        ghost: 'bg-transparent text-foreground hover:bg-[var(--surface-hover)]',
        danger: `${RAISED} valence-raise--tinted [--raise-fill:var(--color-danger)] text-destructive-foreground`,
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
      { variant: ['ghost', 'link', 'overlay'], class: 'shadow-none' },
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
