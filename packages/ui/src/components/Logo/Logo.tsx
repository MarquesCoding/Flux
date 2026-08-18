import { cn } from '@FluxUI/cn';
import type { LogoProps } from './Logo.types';

const MARK = '/flux-logo.svg';

/**
 * The Flux mark, painted rather than drawn.
 *
 * The file is a mask rather than an image, which is what lets the mark take a colour at all: an
 * `<img>` is whatever colour it was exported as, while a mask is a hole through which anything can
 * be seen. What shows through here is a conic gradient from the brand colour through white and back,
 * so the mark is lit rather than filled.
 *
 * The light moves where the mark is worth looking at and holds still where it is not. A logo in the
 * corner of every screen that shimmers all day is a distraction with a licence; the same logo holding
 * the screen on the way in is the one moment it has anybody's attention. So `isAnimated` is asked for
 * rather than assumed, and it stops entirely for anybody who has asked for less motion.
 *
 * How it moves depends on what it is made of. Solid, the gradient turns behind it. Dotted, a wave
 * travels out from the middle and the dots light as it passes — the same ripple the empty screens
 * run through their own dots, so the mark and the ground behind it move by one idea rather than two.
 *
 * @param hasEdge - Whether the mark carries a keyline. Not a box: a copy of the mark sits behind it
 *   in the brand colour, spread a pixel outward by a chain of shadows that follow its alpha, and the
 *   mark itself is laid over the top so only that fringe shows. The mark is given a solid body when
 *   it is edged, since a dotted one would otherwise let the colour behind it through the gaps.
 * @param isDotted - Whether the mark is drawn as a field of dots rather than as solid ink. The dots
 *   rest dim and light as the wave reaches them, which is what a dot-matrix does and what the empty
 *   screens already do behind their own dots. The grid is set in pixels rather than in fractions of
 *   the mark, so the dots are the same size wherever the mark is used. Worth asking for where the
 *   mark is large; at the size it sits in a dock the dots turn to mush.
 * @param size - How large the mark is, in pixels, square; omit to size it from the class, which is
 *   what a mark set beside type wants — `h-[0.72em]` puts it at the cap height of whatever it sits
 *   next to, and it then grows and shrinks with the type rather than being set twice.
 * @param isAnimated - Whether the light turns, which is for screens somebody waits on.
 * @param label - What it is, for anybody who cannot see it; omit where a name sits beside it.
 * @param className - Extra classes for the caller's own layout.
 * @param src - Where the mark is served from, which the application owns.
 */
const Logo = ({
  size,
  isDotted = false,
  hasEdge = false,
  isAnimated = false,
  label,
  className,
  src = MARK,
}: LogoProps) => {
  const cutToTheMark = {
    maskImage: `url(${src})`,
    WebkitMaskImage: `url(${src})`,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
  } as const;

  return (
    <span
      {...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
      style={size === undefined ? {} : { width: size, height: size }}
      className={cn('relative inline-block shrink-0 align-baseline', className)}
    >
      {hasEdge ? (
        <span
          aria-hidden
          style={cutToTheMark}
          className="flux-logo-edge absolute inset-0 bg-accent"
        />
      ) : null}

      <span
        aria-hidden
        style={cutToTheMark}
        className={cn('absolute inset-0 overflow-hidden', hasEdge ? 'bg-surface' : '')}
      >
        <span className={isDotted ? 'flux-logo-dots' : 'absolute inset-0 overflow-hidden'}>
          <span
            className={cn(
              'absolute -inset-1/2 bg-[conic-gradient(from_140deg,#ffffff,#ffffff_25%,var(--color-accent)_55%,#ffffff_85%,#ffffff)]',
              isDotted ? 'opacity-60' : '',
              isAnimated && !isDotted
                ? 'animate-[spin_7s_linear_infinite] motion-reduce:animate-none'
                : '',
            )}
          />

          {isDotted && isAnimated ? <span className="flux-logo-wave" /> : null}
        </span>
      </span>
    </span>
  );
};

Logo.displayName = 'Logo';

export { Logo };
