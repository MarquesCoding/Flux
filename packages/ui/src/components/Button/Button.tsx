import { cn } from '@FluxUI/cn';
import { Spinner } from '@FluxUI/Spinner';
import { Tooltip } from '@FluxUI/Tooltip';
import type { ButtonProps, ButtonSize, ButtonVariant } from './Button.types';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-contrast hover:opacity-90',
  glossy:
    'flux-gloss bg-white text-black hover:brightness-105 hover:shadow-[0_10px_30px_-6px_rgba(255,255,255,0.35)]',
  secondary: 'flux-glass text-text hover:brightness-125',
  ghost: 'bg-transparent text-text hover:bg-white/10',
  danger: 'flux-gloss bg-danger text-white hover:brightness-110',
  bare: '',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-base gap-2',
  lg: 'h-12 px-6 text-lg gap-2.5',
  xl: 'h-14 px-8 text-lg gap-3 font-semibold',
  none: '',
};

/**
 * What an icon on its own is worth: a square, since there is no line of text to
 * set the width.
 */
const ICON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-12',
  xl: 'size-14',
  none: '',
};

/**
 * The button.
 *
 * The only `<button>` element in Flux. Every other control that can be pressed
 * — a page marker, a place in the navigation, a row of a settings menu, an icon
 * in the player — is built out of this one, because a control that reimplements
 * a button reimplements its focus behaviour, its disabled behaviour and its
 * keyboard behaviour, and does so slightly wrong.
 *
 * Wearing only an icon is a shape of this button rather than a component of its
 * own: it insists on a label, becomes square, and shows that label to whoever
 * rests a pointer on it. Everything else about it — how it looks pressed, how
 * it behaves disabled — is unchanged, which is the point.
 */
const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isPill = false,
  isIconOnly = false,
  isActive = false,
  hasTooltip = true,
  label,
  className,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) => {
  const isDisabled = disabled === true || isLoading;

  const control = (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      {...(label === undefined ? {} : { 'aria-label': label })}
      {...(isActive ? { 'aria-pressed': true } : {})}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium',
        'transition-[filter,box-shadow,transform,translate,scale,opacity,background-color,color] duration-200',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100',
        variant === 'bare' ? '' : 'active:scale-[0.98]',
        isPill || isIconOnly ? 'rounded-full' : 'rounded-lg',
        VARIANT_CLASSES[variant],
        isIconOnly ? ICON_SIZE_CLASSES[size] : SIZE_CLASSES[size],
        isActive && variant !== 'bare' ? 'bg-white/20' : '',
        className,
      )}
      {...rest}
    >
      {/* Named for what a button does rather than for what a page does: this
          turns while the thing the button asked for is happening. */}
      {isLoading ? <Spinner size={size === 'sm' ? 'sm' : 'md'} label="Working" /> : null}
      {children}
    </button>
  );

  return label === undefined || !hasTooltip ? control : <Tooltip label={label}>{control}</Tooltip>;
};

Button.displayName = 'Button';

export { Button };
