import { RiPauseLine, RiStopLine } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { GlassPanel } from '@FluxUI/GlassPanel';
import type { AdminMessageOverlayProps } from './AdminMessageOverlay.types';

/**
 * Tells a viewer, over the top of what they were watching, that an administrator has stopped or
 * paused their session and why. Deliberately unavoidable rather than a passing notice: somebody
 * whose film has just halted deserves to be told the reason rather than left to guess at a fault.
 *
 * @param kind - Whether the session was stopped outright or only paused.
 * @param reason - What the administrator gave as their reason.
 * @param onDismiss - Called when the viewer acknowledges it.
 */
const AdminMessageOverlay = ({ kind, reason, onDismiss }: AdminMessageOverlayProps) => {
  if (kind === 'stopped') {
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black text-center">
        <RiStopLine size={32} className="text-text-muted" aria-hidden />

        <p className="max-w-sm text-sm text-white">{reason}</p>

        <Button variant="secondary" size="sm" isPill onClick={onDismiss}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center">
      <GlassPanel className="pointer-events-auto flex items-center gap-3 px-4 py-3 text-white">
        <RiPauseLine size={18} className="shrink-0 text-text-muted" aria-hidden />

        <p className="text-sm">{reason}</p>

        <Button variant="secondary" size="sm" isPill onClick={onDismiss}>
          Dismiss
        </Button>
      </GlassPanel>
    </div>
  );
};

AdminMessageOverlay.displayName = 'AdminMessageOverlay';

export { AdminMessageOverlay };
