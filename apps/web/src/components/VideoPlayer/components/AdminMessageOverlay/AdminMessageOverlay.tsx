import { RiChat1Line, RiPauseLine, RiStopLine } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { GlassPanel } from '@FluxUI/GlassPanel';
import type { AdminMessageOverlayProps } from './AdminMessageOverlay.types';

/**
 * Tells a viewer, over the top of what they are watching, something an administrator wants them to
 * know. Deliberately unavoidable rather than a passing notice: somebody whose film has just halted
 * deserves to be told the reason rather than left to guess at a fault.
 *
 * Stopped blocks the whole stage and only offers a way out: the stream is gone. Paused and a plain
 * message are the lighter banner, because the picture is still there — the difference between them
 * is only that a pause stopped the film and a message did not.
 *
 * @param kind - Whether the session was stopped, paused, or simply spoken to.
 * @param text - The reason, or the message itself.
 * @param onDismiss - Called when the viewer acknowledges it.
 * @returns The overlay.
 */
const AdminMessageOverlay = ({ kind, text, onDismiss }: AdminMessageOverlayProps) => {
  if (kind === 'stopped') {
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black text-center">
        <RiStopLine size={32} className="text-text-muted" aria-hidden />

        <p className="max-w-sm break-words text-sm text-white">{text}</p>

        <Button variant="secondary" size="sm" isPill onClick={onDismiss}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center px-4">
      <GlassPanel className="pointer-events-auto flex max-w-lg items-start gap-3 px-4 py-3 text-white">
        {kind === 'message' ? (
          <RiChat1Line size={18} className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
        ) : (
          <RiPauseLine size={18} className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
        )}

        <p className="min-w-0 flex-1 break-words text-sm">{text}</p>

        <Button variant="secondary" size="sm" isPill className="shrink-0" onClick={onDismiss}>
          Dismiss
        </Button>
      </GlassPanel>
    </div>
  );
};

AdminMessageOverlay.displayName = 'AdminMessageOverlay';

export { AdminMessageOverlay };
