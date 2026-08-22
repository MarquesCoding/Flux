import { Icon } from '@ValenceUI/Icon';
import { DownloadSimpleIcon } from '@phosphor-icons/react';
import type { MissingRowProps } from './MissingRow.types';

/**
 * An episode the catalogue says exists and this library does not have, drawn in place among the ones
 * it does — so a gap is visible where it falls rather than being something to notice by counting.
 *
 * @param episodeNumber - Which episode is missing.
 * @param title - What the catalogue calls it.
 * @param stillUrl - The catalogue's own still, where it has one.
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
          <Icon of={DownloadSimpleIcon} size={20} />
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
