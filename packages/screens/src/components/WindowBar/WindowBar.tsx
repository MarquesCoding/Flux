import type { WindowBarProps } from './WindowBar.types';

/**
 * The strip along the top of the window that picks it up, and draws nothing.
 *
 * A window with no frame has nowhere to be grabbed by, so something has to volunteer — but that is
 * the whole of the job. A bar that also said what the application was and offered a way back was
 * saying things the screen underneath already says better, and it cost every page the height of it.
 *
 * So it is transparent, empty, and out of the flow: the page runs to the top of the window and this
 * lies over it. The cost is that the top of the page cannot be clicked, which is the same bargain
 * every frameless application makes and the reason the operating system puts its own controls there.
 *
 * @param height - How deep the grabbable strip is. Worth raising where something at the top of a
 *   page would otherwise be the only thing to take hold of.
 */
const WindowBar = ({ height = '2.25rem' }: WindowBarProps) => (
  <div
    aria-hidden
    data-slot="window-bar"
    style={{ height }}
    className="fixed inset-x-0 top-0 z-[60] [-webkit-app-region:drag]"
  />
);

WindowBar.displayName = 'WindowBar';

export { WindowBar };
