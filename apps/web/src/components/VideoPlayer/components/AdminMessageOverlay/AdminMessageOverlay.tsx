import { IconMessage, IconPlayerPause, IconPlayerStop } from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { GlassPanel } from '@FluxUI/GlassPanel';
import type { AdminMessageOverlayProps } from './AdminMessageOverlay.types';

/**
 * What an admin's stop, pause or note looks like to the viewer it happened to.
 *
 * A stream that just stalls, or a player that just sits there paused with no
 * explanation, reads as broken. Whichever this is, it says so.
 *
 * A note takes the pause treatment rather than the stop one, and stays until
 * it is dismissed: the film is still running underneath it, and a message
 * nobody saw is a message not sent.
 */
const AdminMessageOverlay = ({ kind, text, onDismiss }: AdminMessageOverlayProps) => {
  if (kind === 'stopped') {
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black text-center">
        <IconPlayerStop size={32} className="text-text-muted" aria-hidden />

        <p className="max-w-sm text-sm text-white">{text}</p>

        <Button variant="secondary" size="sm" isPill onClick={onDismiss}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center">
      <GlassPanel className="pointer-events-auto flex items-center gap-3 px-4 py-3 text-white">
        {kind === 'message' ? (
          <IconMessage size={18} className="shrink-0 text-text-muted" aria-hidden />
        ) : (
          <IconPlayerPause size={18} className="shrink-0 text-text-muted" aria-hidden />
        )}

        <p className="text-sm">{text}</p>

        <Button variant="secondary" size="sm" isPill onClick={onDismiss}>
          Dismiss
        </Button>
      </GlassPanel>
    </div>
  );
};

AdminMessageOverlay.displayName = 'AdminMessageOverlay';

export { AdminMessageOverlay };
