import { useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { TextField } from '@FluxUI/TextField';
import type { MediaPanelProps } from './MediaPanel.types';

/**
 * Everything the libraries hold, and a way to say what one of them really is.
 *
 * One row per programme and per film rather than one per file: a correction
 * names a programme, so a list of ninety episodes would be ninety ways to do
 * the same thing.
 *
 * What is typed into the search stays here rather than in the admin area,
 * because nothing outside this panel has any use for it.
 */
const MediaPanel = ({ isUnreachable = false, media, onCorrect }: MediaPanelProps) => {
  const [search, setSearch] = useState('');

  const shown = media
    .filter((item) =>
      (item.seriesTitle ?? item.title).toLowerCase().includes(search.trim().toLowerCase()),
    )
    .sort((left, right) =>
      (left.seriesTitle ?? left.title).localeCompare(right.seriesTitle ?? right.title),
    );

  return (
    <div className="flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
        <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">
          Everything in the libraries
        </h2>

        <TextField
          label="Find a programme or film"
          isLabelHidden
          type="search"
          placeholder="Find a title"
          value={search}
          onValueChange={setSearch}
          className="w-64 max-w-full"
        />
      </header>

      {isUnreachable ? (
        <p className="p-6 text-sm text-text-muted">
          The libraries could not be read from the server. This is not the same as holding nothing.
        </p>
      ) : shown.length === 0 ? (
        <p className="p-6 text-sm text-text-muted">
          {media.length === 0 ? 'Nothing has been scanned yet.' : 'Nothing here matches that.'}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-white/5">
          {shown.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-text">{item.seriesTitle ?? item.title}</span>
                <span className="truncate font-body text-xs text-text-muted">
                  {item.seriesTitle === null || item.seriesTitle === undefined ? 'Film' : 'Series'}
                  {item.year === null ? '' : ` · ${item.year.toString()}`}
                </span>
              </span>

              <Button
                variant="ghost"
                size="sm"
                isPill
                onClick={() => {
                  onCorrect(item);
                }}
              >
                <IconSearch size={16} aria-hidden />
                Wrong match?
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

MediaPanel.displayName = 'MediaPanel';

export { MediaPanel };
