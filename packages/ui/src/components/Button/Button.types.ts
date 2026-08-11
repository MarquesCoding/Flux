import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * `glossy` is the platform's headline control — lit from above, with a glow
 * that says "press me" from across a room. `primary` stays flat for forms and
 * settings, where a glowing button would be noise.
 *
 * `overlay` is for a control sitting on artwork or video, where the page's own
 * colours say nothing about what is behind it. `link` is text that behaves like
 * a button but reads as a way somewhere.
 *
 * `bare` paints nothing at all. It is for a control that supplies its own
 * shape — a row of page markers, a card that is one big press target, the clock
 * in the player — which needs the behaviour of a button and none of its skin.
 * It means painted by its caller rather than exempt: if a control wants a look
 * this does not offer, that look belongs here, by name.
 */
type ButtonVariant =
  'primary' | 'glossy' | 'secondary' | 'ghost' | 'danger' | 'overlay' | 'link' | 'bare';

/**
 * `none` leaves the height and padding to the caller, for the same reason
 * `bare` leaves the colours.
 */
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'none';

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  /**
   * Optional, because a control can be its own content: a colour swatch is a
   * coloured square, and says what it is through its label rather than through
   * anything inside it.
   */
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  /**
   * Rounds the control fully, which is how a control reads as a pill rather
   * than a box. The platform's shell uses pills throughout.
   */
  isPill?: boolean;
  /**
   * What the control does, in words.
   *
   * Required of anything wearing only an icon: a glyph has no accessible name,
   * and a player made entirely of them would be unusable without sight. Shown
   * to whoever rests a pointer on it, too — a row of glyphs is learnable but
   * not guessable, and the name is already written down.
   */
  label?: string;
  /**
   * Whether this is an icon and nothing else, which makes it square and round
   * rather than a box with words in it.
   */
  isIconOnly?: boolean;
  /**
   * Whether the thing this control does is currently being done. Said as well
   * as shown, so a reader is told which of a row is in force.
   */
  isActive?: boolean;
  /**
   * Whether resting a pointer on it shows the label. On wherever there is a
   * label; off for a control whose name is already written beside it.
   */
  hasTooltip?: boolean;
  className?: string;
};

export type { ButtonProps, ButtonVariant, ButtonSize };
