import { cn } from '@FluxUI/cn';
import { buttonStyles } from './buttonStyles';
import { Spinner } from '@FluxUI/Spinner';
import { Tooltip } from '@FluxUI/Tooltip';
import type { ButtonProps } from './Button.types';

/**
 * The one place a `<button>` is written. Everything pressable in Valence is this or composes it, which
 * is what keeps focus rings, disabled states, loading behaviour and tooltips the same everywhere
 * rather than reinvented per screen. A raw button elsewhere is lint-banned, and there is
 * deliberately no separate icon button — an icon button is this with an icon and a label.
 *
 * How it is painted is declared as variants rather than assembled per caller, so that the
 * combinations — a small icon-only ghost, a large primary — resolve by one set of rules instead of
 * drifting apart. The corner is the loudest thing about a button after its colour, so the default is
 * the same modest radius everything else in Valence wears, whatever is inside it. A circle is asked for
 * rather than inferred: carrying only an icon is not a reason to be round, or every close button in
 * the product becomes a bubble.
 *
 * @param children - What the button shows; optional, since a control can be its own content.
 * @param variant - How it is painted, from the headline glossy down to bare, which paints nothing.
 * @param size - How large it is, or none to leave height and padding to the caller.
 * @param isLoading - Whether the thing it does is under way, which also stops it being pressed twice.
 * @param isPill - Whether to round it fully, which is a circle for an icon on its own.
 * @param label - What it does in words, required of anything wearing only an icon.
 * @param isIconOnly - Whether it is a glyph and nothing else, which makes it square rather than wide.
 * @param isActive - Whether what it does is currently in force, said as well as shown.
 * @param hasTooltip - Whether resting a pointer on it shows the label.
 * @param tooltipDelayMilliseconds - How long a pointer rests before the label appears.
 * @param className - Extra classes for the caller's own layout.
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
  tooltipDelayMilliseconds,
  label,
  className,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) => {
  const isDisabled = disabled === true || isLoading;
  const isBare = variant === 'bare';

  const control = (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      {...(label === undefined ? {} : { 'aria-label': label })}
      {...(isActive ? { 'aria-pressed': true } : {})}
      data-slot="button"
      className={cn(
        buttonStyles({
          variant,
          size,
          isIconOnly,
          shape: isBare && !isPill ? 'bare' : isPill ? 'pill' : 'square',
        }),
        isActive && !isBare ? 'bg-white/20' : '',
        className,
      )}
      {...rest}
    >
      {isLoading ? <Spinner size={size === 'sm' ? 'sm' : 'md'} label="Working" /> : null}
      {children}
    </button>
  );

  return label === undefined || !hasTooltip ? (
    control
  ) : (
    <Tooltip
      label={label}
      {...(tooltipDelayMilliseconds === undefined
        ? {}
        : { delayMilliseconds: tooltipDelayMilliseconds })}
    >
      {control}
    </Tooltip>
  );
};

Button.displayName = 'Button';

export { Button };
