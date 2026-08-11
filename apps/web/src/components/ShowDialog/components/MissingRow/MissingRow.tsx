import { IconFileOff } from '@tabler/icons-react';
import type { MissingRowProps } from './MissingRow.types';

/**
 * An episode the series has and the library does not.
 *
 * Drawn in the place it would occupy rather than listed as a warning
 * elsewhere, because the gap is the point: a viewer reading down a season
 * meets the hole where the episode should be, in the order they were counting.
 *
 * Not a control. There is nothing to press — the file is not here, and a row
 * that looks pressable and does nothing is worse than one that plainly cannot
 * be.
 */
const MissingRow = ({ episodeNumber }: MissingRowProps) => (
  <div className="flex items-center gap-3 py-3 opacity-60">
    <span className="flex min-w-0 flex-1 items-center gap-4 text-left">
      <span className="w-8 shrink-0 text-center text-sm tabular-nums text-text-muted">
        {episodeNumber}
      </span>

      <span className="flex aspect-video w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 text-text-muted sm:w-36">
        <IconFileOff size={20} aria-hidden />
      </span>

      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-medium text-text-muted">
          Episode {episodeNumber}
        </span>
        <span className="font-body text-xs text-text-muted">Not in this library</span>
      </span>
    </span>
  </div>
);

MissingRow.displayName = 'MissingRow';

export { MissingRow };
