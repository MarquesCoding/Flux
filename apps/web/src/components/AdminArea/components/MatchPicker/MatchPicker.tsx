import { useEffect, useState } from 'react';
import { RiArrowGoBackLine, RiSearchLine } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogFooter } from '@FluxUI/DialogFooter';
import { DialogTitle } from '@FluxUI/DialogTitle';
import { Spinner } from '@FluxUI/Spinner';
import { TextField } from '@FluxUI/TextField';
import { searchCatalogue } from '@FluxWeb/admin/fetchAdmin';
import { correctMatch, forgetCorrection } from '@FluxWeb/library/fetchLibrary';
import type { CatalogueMatch } from '@FluxWeb/admin/fetchAdmin';
import type { MatchPickerProps } from './MatchPicker.types';

/**
 * Corrects what the catalogue made of a file. Shows what it was matched to, offers a search of the
 * catalogue to find what it should have been, and records the correction so that later scans keep it
 * rather than guessing again from the filename.
 *
 * @param media - The item being corrected, or null when the picker is closed.
 * @param onClose - Called when it is dismissed.
 * @param onCorrected - Called once a correction is recorded, with the job refetching its details.
 */
const MatchPicker = ({ media, onClose, onCorrected }: MatchPickerProps) => {
  const isEpisode = media?.seriesTitle !== null && media?.seriesTitle !== undefined;
  const kind = isEpisode ? ('tv' as const) : ('movie' as const);

  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<CatalogueMatch[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [isForgetting, setIsForgetting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (media === null) {
      return;
    }

    setQuery(media.seriesTitle ?? media.title);
    setMatches(null);
    setProblem(null);
  }, [media]);

  const look = async (asked: string) => {
    setIsSearching(true);
    setProblem(null);

    const found = await searchCatalogue(asked, kind);

    setMatches(found);
    setIsSearching(false);
  };

  const choose = async (match: CatalogueMatch) => {
    if (media === null) {
      return;
    }

    setSaving(match.externalId);
    setProblem(null);

    const outcome = await correctMatch(media.id, match.externalId, match.kind);

    setSaving(null);

    if ('problem' in outcome) {
      setProblem(outcome.problem);

      return;
    }

    onCorrected(outcome.jobId);
    onClose();
  };

  const forget = async () => {
    if (media === null) {
      return;
    }

    setIsForgetting(true);
    setProblem(null);

    const outcome = await forgetCorrection(media.id);

    setIsForgetting(false);

    if (outcome === null) {
      setProblem('That could not be put back.');

      return;
    }

    onCorrected(outcome.jobId);
    onClose();
  };

  return (
    <Dialog
      label={media?.seriesTitle ?? media?.title ?? 'This item'}
      isOpen={media !== null}
      onClose={onClose}
    >
      <DialogTitle
        title={media?.seriesTitle ?? media?.title ?? 'This item'}
        detail={
          isEpisode
            ? 'Choosing here corrects every episode of this series, and every scan after it.'
            : 'Choosing here corrects this film, and every scan after it.'
        }
      />

      <DialogContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label={`Search for a ${isEpisode ? 'series' : 'film'}`}
            value={query}
            onValueChange={setQuery}
            className="min-w-0 flex-1"
          />

          <Button
            variant="secondary"
            isPill
            disabled={query.trim() === ''}
            isLoading={isSearching}
            onClick={() => {
              void look(query);
            }}
          >
            <RiSearchLine size={16} aria-hidden />
            Search
          </Button>
        </div>

        {problem === null ? null : (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        )}

        {isSearching ? <Spinner label="Asking the catalogue" size="sm" /> : null}

        {matches === null || isSearching ? null : matches.length === 0 ? (
          <p className="font-body text-sm text-text-muted">Nothing came back under that name.</p>
        ) : (
          <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {matches.map((match) => (
              <li key={`${match.kind}-${match.externalId}`}>
                <Button
                  variant="bare"
                  size="none"
                  className="flex w-full items-start gap-4 rounded-xl p-2 text-left hover:bg-[var(--surface-hover)]"
                  isLoading={saving === match.externalId}
                  onClick={() => {
                    void choose(match);
                  }}
                >
                  <span className="aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg bg-surface-raised">
                    {match.posterUrl === null ? null : (
                      <img
                        src={match.posterUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>

                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-medium text-text">
                      {match.title}
                      {match.year === null ? '' : ` (${match.year.toString()})`}
                    </span>
                    <span className="line-clamp-2 font-body text-xs text-text-muted">
                      {match.overview ?? 'No synopsis.'}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>

      <DialogFooter>
        <Button
          variant="secondary"
          isPill
          isLoading={isForgetting}
          onClick={() => {
            void forget();
          }}
        >
          <RiArrowGoBackLine size={16} aria-hidden />
          Forget the correction
        </Button>

        <Button variant="secondary" isPill onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

MatchPicker.displayName = 'MatchPicker';

export { MatchPicker };
