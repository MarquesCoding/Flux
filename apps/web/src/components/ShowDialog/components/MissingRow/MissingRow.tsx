import { RiDownloadLine } from '@remixicon/react';
import type { MissingRowProps } from './MissingRow.types';

/**
 * An episode the series has and the library does not.
 *
 * Drawn where it belongs in the season rather than listed as a warning
 * elsewhere, and drawn as fully as the catalogue allows: its name, its still,
 * its number. A viewer meeting a gap wants to know which episode it is, and
 * "Episode 3 is absent" answers a question nobody asked.
 *
 * What it does not have is a way to play it, because there is nothing to play.
 * The still is dimmed and unpressable, which is the only honest way to draw a
 * row for a file that is not here.
 */
const MissingRow = ({ episodeNumber, title, stillUrl }: MissingRowProps) => (
  <div className="flex items-center gap-3 py-3">
    <span className="flex min-w-0 flex-1 items-center gap-4 text-left">
      <span className="w-8 shrink-0 text-center text-sm tabular-nums text-text-muted">
        {episodeNumber}
      </span>

      <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-surface-raised ring-1 ring-dashed ring-white/15 sm:w-36">
        {stillUrl === null || stillUrl === undefined ? null : (
          <img
            src={stillUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-40 grayscale"
          />
        )}

        <span className="absolute inset-0 flex items-center justify-center text-text-muted">
          <RiDownloadLine size={20} aria-hidden />
        </span>
      </span>

      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-medium text-text-muted">
          {title ?? `Episode ${episodeNumber.toString()}`}
        </span>
        <span className="font-body text-xs text-text-muted">Not in this library</span>
      </span>
    </span>
  </div>
);

MissingRow.displayName = 'MissingRow';

export { MissingRow };
