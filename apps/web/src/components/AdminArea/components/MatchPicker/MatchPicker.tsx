import { useEffect, useState } from 'react';
import { IconArrowBackUp, IconSearch } from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { Dialog } from '@FluxUI/Dialog';
import { Spinner } from '@FluxUI/Spinner';
import { TextField } from '@FluxUI/TextField';
import { searchCatalogue } from '@FluxWeb/admin/fetchAdmin';
import { correctMatch, forgetCorrection } from '@FluxWeb/library/fetchLibrary';
import type { CatalogueMatch } from '@FluxWeb/admin/fetchAdmin';
import type { MatchPickerProps } from './MatchPicker.types';

/**
 * Finds what a file should have been matched to, and says so.
 *
 * Searching by name rather than asking for an id, because somebody looking at
 * a wrong title knows the right title — the id is a detail of the catalogue
 * they should not have to go and look up. Picking from what comes back is also
 * the confirmation step: the poster and the year say whether this is the one.
 *
 * A correction here reaches the whole series, since the id names a programme.
 *
 * Forgetting one is deleting a row rather than fetching anything: the
 * catalogue's own answer was never overwritten, so putting a file back is
 * letting the matcher speak again rather than restoring a copy.
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

    onCorrected();
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

    onCorrected();
    onClose();
  };

  return (
    <Dialog
      label={`What is ${media?.seriesTitle ?? media?.title ?? 'this'}?`}
      isOpen={media !== null}
      onClose={onClose}
      className="w-[min(46rem,94vw)]"
    >
      <div className="flex flex-col gap-5 p-6">
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight text-text">
            {media?.seriesTitle ?? media?.title}
          </h2>
          <p className="font-body text-sm text-text-muted">
            {isEpisode
              ? 'Choosing here corrects every episode of this series, and every scan after it.'
              : 'Choosing here corrects this film, and every scan after it.'}
          </p>
        </header>

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
            <IconSearch size={16} aria-hidden />
            Search
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="min-w-0 font-body text-xs text-text-muted">
            Or put it back and let the catalogue decide again.
          </p>

          <Button
            variant="ghost"
            size="sm"
            isPill
            isLoading={isForgetting}
            onClick={() => {
              void forget();
            }}
          >
            <IconArrowBackUp size={16} aria-hidden />
            Forget the correction
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
                  className="flex w-full items-start gap-4 rounded-xl p-2 text-left hover:bg-white/5"
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
      </div>
    </Dialog>
  );
};

MatchPicker.displayName = 'MatchPicker';

export { MatchPicker };
