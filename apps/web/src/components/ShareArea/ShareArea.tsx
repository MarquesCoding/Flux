import { useEffect, useState } from 'react';
import { RiLinkUnlinkM, RiPlayFill } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { Spinner } from '@FluxUI/Spinner';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import { openShare } from '@FluxWeb/sharing/fetchShares';
import { MediaFacts } from '@FluxWeb/components/MediaFacts/MediaFacts';
import { inBroadcastOrder } from '@FluxCore/functions/inBroadcastOrder';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { OpenedShare } from '@FluxWeb/sharing/fetchShares';
import type { ShareAreaProps } from './ShareArea.types';

type Standing =
  { kind: 'reading' } | { kind: 'opened'; share: OpenedShare } | { kind: 'closed'; reason: string };

/**
 * What somebody with no account sees when they follow a link. Deliberately not the library with
 * parts hidden: there is no dock, no search and no way anywhere else, because there is nothing else
 * they were given. A link that has run out says so in words rather than failing silently or offering
 * a sign-in they do not have.
 *
 * A guest has no profile, so nothing they do is recorded — where they got to lives for as long as
 * the page does and no longer, which is enough to stop a binge restarting each episode from zero
 * without giving somebody with no account anything that persists.
 *
 * @param token - The token the link carries.
 * @param onPlay - Told to start something, and where from.
 * @param resumeFor - Where they got to in a given episode, for as long as this page lives.
 * @param name - What this server calls itself.
 */
const ShareArea = ({ token, onPlay, resumeFor, name = 'Flux' }: ShareAreaProps) => {
  const [standing, setStanding] = useState<Standing>({ kind: 'reading' });

  useEffect(() => {
    let abandoned = false;

    setStanding({ kind: 'reading' });

    void openShare(token).then((outcome) => {
      if (abandoned) {
        return;
      }

      if (outcome.kind === 'opened') {
        setStanding({ kind: 'opened', share: outcome.share });

        return;
      }

      setStanding({
        kind: 'closed',
        reason:
          outcome.kind === 'gone' ? outcome.reason : 'This link does not work. Ask for a new one.',
      });
    });

    return () => {
      abandoned = true;
    };
  }, [token]);

  const start = (media: MediaSummary) => {
    onPlay(media, resumeFor?.(media.id) ?? 0);
  };

  if (standing.kind === 'reading') {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner label={`Opening what was shared with you on ${name}`} />
      </main>
    );
  }

  if (standing.kind === 'closed') {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <RiLinkUnlinkM size={40} aria-hidden className="text-text-muted" />

        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-text">{standing.reason}</h1>

        <p className="max-w-[40ch] font-body text-sm text-text-muted">
          Whoever sent it can send another.
        </p>
      </main>
    );
  }

  const { share } = standing;
  const [first] = [...share.items].sort(inBroadcastOrder);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-10 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-3">
        <span className="text-xs uppercase tracking-[0.2em] text-text-muted">
          Shared with you on {name}
        </span>

        <h1 className="text-[clamp(2rem,6vw,3.25rem)] font-semibold leading-[0.95] tracking-[-0.03em] text-text">
          {share.title}
        </h1>

        {first === undefined ? null : (
          <MediaFacts
            media={first}
            hasRuntime
            hasEpisode={share.kind === 'series'}
            className="flex flex-wrap items-center gap-2 text-sm font-medium tracking-[0.14em] text-text-muted"
          />
        )}
      </header>

      {first === undefined ? (
        <p className="font-body text-sm text-text-muted">There is nothing here to watch.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="glossy"
            size="lg"
            isPill
            onClick={() => {
              start(first);
            }}
          >
            <RiPlayFill size={18} aria-hidden />
            {share.kind === 'series' ? 'Play the first episode' : 'Play'}
          </Button>
        </div>
      )}

      {share.kind === 'series' && share.items.length > 1 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
            Episodes
          </h2>

          <ul className="flex flex-col gap-1">
            {[...share.items].sort(inBroadcastOrder).map((episode) => (
              <li key={episode.id}>
                <Button
                  variant="ghost"
                  size="none"
                  className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left"
                  onClick={() => {
                    start(episode);
                  }}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-text">{episode.title}</span>
                    <span className="font-body text-xs text-text-muted">
                      {typeof episode.seasonNumber === 'number' &&
                      typeof episode.episodeNumber === 'number'
                        ? `S${episode.seasonNumber.toString()} · EP${episode.episodeNumber.toString()} · ${formatDuration(episode.durationSeconds)}`
                        : formatDuration(episode.durationSeconds)}
                    </span>
                  </span>

                  <RiPlayFill size={18} aria-hidden className="shrink-0 text-text-muted" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
};

ShareArea.displayName = 'ShareArea';

export { ShareArea };
