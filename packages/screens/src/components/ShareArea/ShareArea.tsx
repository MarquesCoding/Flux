import { Icon } from '@FluxUI/Icon';
import { useEffect, useState } from 'react';
import { Spinner } from '@FluxUI/Spinner';
import { openShare } from '@FluxClient/sharing/fetchShares';
import { Hero } from '@FluxScreens/components/Hero/Hero';
import { EpisodeRow } from '@FluxScreens/components/ShowDialog/components/EpisodeRow/EpisodeRow';
import { inBroadcastOrder } from '@FluxCore/functions/inBroadcastOrder';
import { intoSeasons } from '@FluxClient/library/intoSeasons';
import { nameSeason } from '@FluxClient/library/nameSeason';
import { describeShareEnding } from '@FluxScreens/sharing/describeShareEnding';
import type { OpenedShare } from '@FluxClient/sharing/fetchShares';
import type { ShareEnding } from '@FluxContracts/schemas/Share';
import type { ShareAreaProps } from './ShareArea.types';

type Standing =
  | { kind: 'reading' }
  | { kind: 'opened'; share: OpenedShare }
  | { kind: 'closed'; ended: ShareEnding | null };

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
 * A programme fills the screen and then gives way as it is scrolled, the way the library's own hero
 * does, because there is a list underneath worth arriving at. A single item has nothing beneath it,
 * so it simply fills the screen and stays there.
 *
 * @param token - The token the link carries.
 * @param onPlay - Told to start something, and where from.
 * @param resumeFor - Where they got to in a given episode, for as long as this page lives.
 * @param ended - How the link stopped working, where something noticed before this screen did. Shown
 *   at once rather than asking again, so a guest whose link is withdrawn mid-stream is told
 *   immediately instead of watching a spinner while the server repeats what is already known.
 * @param name - What this server calls itself.
 */
const ShareArea = ({ token, onPlay, resumeFor, ended, name = 'Flux' }: ShareAreaProps) => {
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

      setStanding({ kind: 'closed', ended: outcome.kind === 'gone' ? outcome.ended : null });
    });

    return () => {
      abandoned = true;
    };
  }, [token]);

  const closed = ended ?? (standing.kind === 'closed' ? standing.ended : null);

  if (closed !== null || standing.kind === 'closed') {
    const told = closed === null ? null : describeShareEnding(closed);

    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        {told === null ? null : <Icon of={told.icon} size={40} className="text-text-muted" />}

        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-text">
          {told?.said ?? 'This link does not work.'}
        </h1>

        <p className="max-w-[40ch] font-body text-sm text-text-muted">
          {told?.detail ?? 'Ask whoever sent it for a new one.'}
        </p>
      </main>
    );
  }

  if (standing.kind !== 'opened') {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner label={`Opening what was shared with you on ${name}`} />
      </main>
    );
  }

  const { share } = standing;
  const [first] = [...share.items].sort(inBroadcastOrder);
  const hasEpisodes = share.kind === 'series' && share.items.length > 1;

  if (first === undefined) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-text">{share.title}</h1>

        <p className="font-body text-sm text-text-muted">There is nothing here to watch.</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-svh">
      <span className="pointer-events-none absolute left-5 top-6 z-20 text-xs uppercase tracking-[0.2em] text-text-muted sm:left-10">
        Shared with you on {name}
      </span>

      <Hero
        fills={!hasEpisodes}
        items={[first]}
        onPlay={(media, startSeconds) => {
          onPlay(media, startSeconds);
        }}
        resumeFor={(mediaId) => resumeFor?.(mediaId) ?? null}
      />

      {hasEpisodes ? (
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 pb-16 pt-8 sm:px-8">
          {intoSeasons(share.items).map((season) => (
            <div key={String(season.seasonNumber)} className="flex flex-col gap-3">
              <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
                {nameSeason(season.seasonNumber)}
              </h2>

              <ul className="flex flex-col gap-2">
                {season.episodes.map((episode) => {
                  const reached = resumeFor?.(episode.id) ?? null;

                  return (
                    <li key={episode.id}>
                      <EpisodeRow
                        episode={episode}
                        onPlay={(media, startSeconds) => {
                          onPlay(media, startSeconds);
                        }}
                        {...(reached === null ? {} : { resumeSeconds: reached })}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
};

ShareArea.displayName = 'ShareArea';

export { ShareArea };
