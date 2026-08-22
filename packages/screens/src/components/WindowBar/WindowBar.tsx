import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@FluxUI/Button';
import { Icon } from '@FluxUI/Icon';
import { Logo } from '@FluxUI/Logo';
import type { WindowBarProps } from './WindowBar.types';

const PAST_THE_TRAFFIC_LIGHTS = 'w-[68px]';

const CENTRED_ON_THE_WINDOW = 'absolute left-1/2 -translate-x-1/2';

const AN_ARROW =
  'flex h-7 w-7 items-center justify-center rounded-md text-text-muted outline-none ring-0 focus:outline-none focus-visible:bg-white/10 focus-visible:ring-0 disabled:opacity-35';

/**
 * The bar along the top of the window, which a browser draws for itself and a window has to be given.
 *
 * A page in a browser sits inside chrome that already says where it is and offers a way back. Take
 * the browser away and all of that goes with it, which leaves an application window feeling like a
 * page that has lost something. This puts it back.
 *
 * It says what the application is and nothing else. What somebody is watching is on the screen in
 * front of them, already named twice over; saying it a third time along the top is a line of text
 * that changes constantly and tells nobody anything.
 *
 * It sits in the page rather than over it. That is the whole difference between this and a strip
 * pinned to the top: a bar in the flow takes its own height, so every screen underneath begins below
 * it without being told anything, and it stays put while the page scrolls. It is painted solid for
 * the same reason — a translucent bar is a bar you can read the page through.
 *
 * The whole of it drags the window, because a window with no frame has nowhere else to be picked up
 * by. The controls in it are marked as not, or they would move the window instead of being pressed.
 *
 * The title is centred on the window rather than on what is left of it. Laid out in the row it would
 * sit in the middle of the space the traffic lights and the arrows have not taken — which is not the
 * middle of anything somebody is looking at, and reads as a title nudged slightly to one side.
 *
 * @param name - What this application is called.
 * @param canGoBack - Whether there is anywhere behind us.
 * @param canGoForward - Whether there is anywhere ahead of us.
 * @param onBack - Go back.
 * @param onForward - Go forward.
 */
const WindowBar = ({ name, canGoBack, canGoForward, onBack, onForward }: WindowBarProps) => {
  return (
    <header className="sticky top-0 z-50 flex h-9 w-full shrink-0 items-center gap-1 border-b border-border bg-surface px-2 [-webkit-app-region:drag]">
      <div className={`${PAST_THE_TRAFFIC_LIGHTS} shrink-0`} />

      <div className="flex shrink-0 items-center gap-0.5 [-webkit-app-region:no-drag]">
        <Button
          isIconOnly
          variant="bare"
          size="sm"
          label="Back"
          disabled={!canGoBack}
          onClick={onBack}
          className={AN_ARROW}
        >
          <Icon of={ArrowLeft01Icon} size={16} />
        </Button>

        <Button
          isIconOnly
          variant="bare"
          size="sm"
          label="Forward"
          disabled={!canGoForward}
          onClick={onForward}
          className={AN_ARROW}
        >
          <Icon of={ArrowRight01Icon} size={16} />
        </Button>
      </div>

      <p className={`${CENTRED_ON_THE_WINDOW} flex items-center gap-1.5 text-[13px] leading-none`}>
        <Logo size={16} />

        <span className="font-semibold text-text">{name}</span>
      </p>
    </header>
  );
};

WindowBar.displayName = 'WindowBar';

export { AN_ARROW, CENTRED_ON_THE_WINDOW, PAST_THE_TRAFFIC_LIGHTS, WindowBar };
