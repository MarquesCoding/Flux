import { Icon } from '@FluxUI/Icon';
import { Unlink01Icon } from '@hugeicons/core-free-icons';
import { useEffect, useState } from 'react';
import { Spinner } from '@FluxUI/Spinner';
import { openShare } from '@FluxWeb/sharing/fetchShares';
import { Hero } from '@FluxWeb/components/Hero/Hero';
import { EpisodeRow } from '@FluxWeb/components/ShowDialog/components/EpisodeRow/EpisodeRow';
import { inBroadcastOrder } from '@FluxCore/functions/inBroadcastOrder';
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
 * @param endedReason - Why the link stopped working, where something noticed before this screen did.
 *   Shown at once rather than asking again, so a guest whose link is withdrawn mid-stream is told
 *   immediately instead of watching a spinner while the server repeats what is already known.
 * @param name - What this server calls itself.
 */
const ShareArea = ({ token, onPlay, resumeFor, endedReason, name = 'Flux' }: ShareAreaProps) => {
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

  const closed = endedReason ?? (standing.kind === 'closed' ? standing.reason : null);

  if (closed !== null) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <Icon of={Unlink01Icon} size={40} className="text-text-muted" />

        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-text">{closed}</h1>

        <p className="max-w-[40ch] font-body text-sm text-text-muted">
          Whoever sent it can send another.
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
        fills
        items={[first]}
        onPlay={(media, startSeconds) => {
          onPlay(media, startSeconds);
        }}
        resumeFor={(mediaId) => resumeFor?.(mediaId) ?? null}
      />

      {share.kind === 'series' && share.items.length > 1 ? (
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-5 pb-16 sm:px-8">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
            Episodes
          </h2>

          <ul className="flex flex-col gap-2">
            {[...share.items].sort(inBroadcastOrder).map((episode) => {
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
        </section>
      ) : null}
    </main>
  );
};

ShareArea.displayName = 'ShareArea';

export { ShareArea };
