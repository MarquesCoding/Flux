import { useState } from 'react';
import { IconExternalLink } from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { TextField } from '@FluxUI/TextField';
import { correctMatch } from '@FluxWeb/library/fetchLibrary';
import { readCatalogueReference } from '@FluxCore/functions/readCatalogueReference';
import type { MatchCorrectionProps } from './MatchCorrection.types';

/**
 * Says this is the wrong film or programme, and which one it is instead.
 *
 * The most useful correction there is, because it is one action rather than a
 * dozen: an id fixes the title, the year, the synopsis, the artwork, the cast
 * and the rating together, and every future scan reads the same right answer
 * without being told again.
 *
 * Takes an address rather than only a number, because nobody copies the
 * number — they copy what is in the address bar.
 */
const MatchCorrection = ({ mediaId, isEpisode, onCorrected }: MatchCorrectionProps) => {
  const [reference, setReference] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const read = readCatalogueReference(reference);
  const needsKind = read !== null && read.kind === null;
  const kind = isEpisode ? ('tv' as const) : ('movie' as const);

  const save = async () => {
    setIsSaving(true);
    setProblem(null);

    const outcome = await correctMatch(mediaId, reference, kind);

    setIsSaving(false);

    if ('problem' in outcome) {
      setProblem(outcome.problem);

      return;
    }

    setReference('');
    onCorrected();
  };

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
        Wrong {isEpisode ? 'programme' : 'film'}?
      </h3>

      <p className="max-w-prose font-body text-sm text-text-muted">
        Paste its address on The Movie Database and everything here is read again from it.
        {isEpisode ? ' The whole series is corrected, not this episode alone.' : ''}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="Catalogue address"
          isLabelHidden
          placeholder="themoviedb.org/tv/230059"
          value={reference}
          onValueChange={(next) => {
            setReference(next);
            setProblem(null);
          }}
          className="min-w-0 flex-1"
        />

        <Button
          variant="secondary"
          isPill
          disabled={read === null}
          isLoading={isSaving}
          onClick={() => {
            void save();
          }}
        >
          <IconExternalLink size={16} aria-hidden />
          Read it again
        </Button>
      </div>

      {problem === null ? null : (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}

      {reference === '' || read !== null ? null : (
        <p className="font-body text-xs text-text-muted">
          That does not look like a catalogue address or id yet.
        </p>
      )}

      {!needsKind ? null : (
        <p className="font-body text-xs text-text-muted">
          Read as {kind === 'tv' ? 'a series' : 'a film'}, since the number alone does not say.
        </p>
      )}
    </section>
  );
};

MatchCorrection.displayName = 'MatchCorrection';

export { MatchCorrection };
