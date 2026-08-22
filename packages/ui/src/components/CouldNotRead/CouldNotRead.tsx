import { Button } from '@ValenceUI/Button';
import { Icon } from '@ValenceUI/Icon';
import { cn } from '@ValenceUI/cn';
import { WarningIcon } from '@phosphor-icons/react';
import type { CouldNotReadProps } from './CouldNotRead.types';

/**
 * Says that something could not be read, and offers to try again.
 *
 * It is the third state a panel needs and the one that was missing. A panel reading from the server
 * has three answers, not two: it is still reading, there is nothing there, or it could not find out.
 * Where the third was drawn as the second — an empty shelf for a refused session or a server that is
 * down — somebody was told there is nothing rather than that nobody knows, which is a different fact
 * and points at a different fix.
 *
 * Trying again is offered rather than merely described because most of what puts a panel here passes:
 * a request that timed out, a server part way through starting, a network that dropped. Where it does
 * not pass, pressing it costs nothing.
 *
 * @param what - What could not be read, named as the reader would name it, such as `your library`.
 * @param onTryAgain - Asked to read it again.
 * @param isTryingAgain - Whether that is happening now, which the button shows rather than the panel.
 * @param className - Extra classes for the caller's own layout.
 */
const CouldNotRead = ({
  what,
  onTryAgain,
  isTryingAgain = false,
  className,
}: CouldNotReadProps) => (
  <div
    role="alert"
    className={cn('flex flex-col items-center gap-3 px-6 py-10 text-center', className)}
  >
    <Icon of={WarningIcon} size={24} className="text-danger" />

    <p className="text-sm text-text-muted">
      {what} could not be read. The server may be unreachable, or this session may have ended.
    </p>

    <Button variant="secondary" size="sm" isLoading={isTryingAgain} onClick={onTryAgain}>
      Try again
    </Button>
  </div>
);

CouldNotRead.displayName = 'CouldNotRead';

export { CouldNotRead };
