import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGroup } from 'motion/react';
import { Outlet } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ProfileGate } from '@ValenceScreens/components/ProfileGate/ProfileGate';
import { SplashScreen } from '@ValenceUI/SplashScreen';
import { shellContext } from '@ValenceClient/shell/shellContext';
import { sessionQueries } from '@ValenceClient/query/sessionQueries';
import { viewingQueries } from '@ValenceClient/query/viewingQueries';
import { libraryQueries } from '@ValenceClient/query/libraryQueries';
import { useWatchParty } from '@ValenceClient/party/useWatchParty';
import { profileQueries } from '@ValenceClient/query/profileQueries';
import { watchPresence } from '@ValenceClient/presence/watchPresence';
import { byMediaId } from '@ValenceClient/playback/watchProgress';
import { summariseDetail } from '@ValenceClient/library/summariseDetail';
import { usePlace } from '@ValenceScreens/navigation/usePlace';
import { useBrowsingPresence } from '@ValenceScreens/playback/useBrowsingPresence';
import { useTellTheServerWhatIsHeld } from '@ValenceClient/downloads/useTellTheServerWhatIsHeld';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import type { MoodLight } from '@ValenceUI/MoodBackground.types';
import type { WatchProgress } from '@ValenceContracts/schemas/WatchProgress';
import type { StartOverride } from '@ValenceClient/shell/shell.types';
import type { SignedInProps } from './SignedIn.types';

const PARTY_NOTICE_LINGERS_MS = 6000;

const MARK_FLIES_MS = 300;

const MARKS_PLACE = 'valence-mark';

/**
 * Everything behind the way in: who is watching, what they have seen, how far through it they are,
 * and the watch party they may be in. Held here rather than in each page, because the player, the
 * dialogs and the grids all read the same answers and must agree about them.
 *
 * @param title - What this instance is called.
 */
const SignedIn = ({ title }: SignedInProps) => {
  const cache = useQueryClient();
  const { place, go, replace } = usePlace();

  const session = useQuery(sessionQueries.who());
  const user = session.data ?? null;

  const [known, setKnown] = useState(new Map<string, MediaSummary>());
  const [reported, setReported] = useState(new Map<string, WatchProgress>());
  const [startOverride, setStartOverride] = useState<StartOverride>(null);
  const [moodLights, setMoodLights] = useState<MoodLight[]>([]);
  const [askingAbout, setAskingAbout] = useState<MediaSummary | null>(null);

  const watchParty = useWatchParty();

  const [isPageReading, setIsPageReading] = useState(false);

  const holdTheScreen = useCallback((isHolding: boolean) => {
    setIsPageReading(isHolding);
  }, []);

  const isWaiting = session.isPending || isPageReading;

  const [phase, setPhase] = useState<'holding' | 'fading' | 'gone'>('holding');

  const isHoldingTheScreen = phase === 'holding';

  useEffect(() => {
    if (phase === 'gone' || isWaiting) {
      return;
    }

    setPhase('fading');

    const goes = setTimeout(() => {
      setPhase('gone');
    }, MARK_FLIES_MS);

    return () => {
      clearTimeout(goes);
    };
  }, [isWaiting, phase]);

  useBrowsingPresence();
  useTellTheServerWhatIsHeld();

  const watched = useQuery(viewingQueries.progress());

  const progress = useMemo(() => {
    const held = byMediaId(watched.data ?? []);

    for (const [mediaId, mine] of reported) {
      const theirs = held.get(mediaId);

      if (theirs === undefined || Math.abs(theirs.positionSeconds - mine.positionSeconds) > 1) {
        held.set(mediaId, mine);
      }
    }

    return held;
  }, [watched.data, reported]);

  useEffect(() => {
    const held = byMediaId(watched.data ?? []);

    setReported((current) => {
      const next = new Map(current);

      for (const [mediaId, mine] of current) {
        const theirs = held.get(mediaId);

        if (theirs !== undefined && Math.abs(theirs.positionSeconds - mine.positionSeconds) <= 1) {
          next.delete(mediaId);
        }
      }

      return next.size === current.size ? current : next;
    });
  }, [watched.data]);

  const watching = useQuery({ ...profileQueries.watching(), enabled: user !== null });

  const watcher = watching.data ?? null;

  const everyone = useQuery({
    ...sessionQueries.everyone(),
    enabled: watchParty.party !== null,
  });

  const household = useMemo(
    () => (everyone.data ?? []).map((person) => ({ id: person.id, name: person.name })),
    [everyone.data],
  );

  const rememberItems = useCallback((items: MediaSummary[]) => {
    setKnown((current) => {
      const next = new Map(current);

      for (const item of items) {
        next.set(item.id, item);
      }

      return next;
    });
  }, []);

  const reportProgress = useCallback((entry: WatchProgress) => {
    setReported((current) => new Map(current).set(entry.mediaId, entry));
  }, []);

  const readProgress = useCallback(
    async () => cache.invalidateQueries({ queryKey: viewingQueries.progress().queryKey }),
    [cache],
  );

  const refresh = useCallback(
    async () => cache.invalidateQueries({ queryKey: sessionQueries.key }),
    [cache],
  );

  useEffect(() => {
    if (user === null) {
      return;
    }

    return watchPresence();
  }, [user]);

  useEffect(() => {
    if (place.playing === null) {
      setStartOverride(null);
    }
  }, [place.playing]);

  useEffect(() => {
    const wanted = [place.playing, place.inspecting]
      .filter((id) => id !== null)
      .filter((id) => !known.has(id));

    if (wanted.length === 0) {
      return;
    }

    let abandoned = false;

    void Promise.all(
      wanted.map(async (id) => ({
        id,
        detail: await cache.ensureQueryData(libraryQueries.detail(id)).catch(() => null),
      })),
    ).then((answers) => {
      if (abandoned) {
        return;
      }

      const summaries = answers
        .map((answer) => answer.detail)
        .filter((detail) => detail !== null)
        .map(summariseDetail);

      if (summaries.length > 0) {
        rememberItems(summaries);
      }

      const missing = answers.filter((answer) => answer.detail === null).map((answer) => answer.id);

      if (missing.includes(place.playing ?? '')) {
        replace({ playing: null });
      }

      if (missing.includes(place.inspecting ?? '')) {
        replace({ inspecting: null });
      }
    });

    return () => {
      abandoned = true;
    };
  }, [place.playing, place.inspecting, known, rememberItems, replace, cache]);

  useEffect(() => {
    if (watchParty.party !== null && place.party !== watchParty.party.id) {
      replace({ playing: watchParty.party.mediaId, party: watchParty.party.id });
    }
  }, [watchParty.party, place.party, replace]);

  useEffect(() => {
    if (watchParty.notice === null) {
      return;
    }

    if (place.party !== null) {
      replace({ party: null });
    }

    const goes = setTimeout(() => {
      watchParty.forgetNotice();
    }, PARTY_NOTICE_LINGERS_MS);

    return () => {
      clearTimeout(goes);
    };
  }, [watchParty.notice, watchParty.forgetNotice, place.party, replace]);

  const shell = useMemo(
    () =>
      user === null
        ? null
        : {
            title,
            user,
            watcher,
            household,
            known,
            rememberItems,
            progress,
            reportProgress,
            readProgress,
            startOverride,
            setStartOverride,
            moodLights,
            setMoodLights,
            askingAbout,
            setAskingAbout,
            watchParty,
            refresh,
            holdTheScreen,
            isHoldingTheScreen,
          },
    [
      title,
      user,
      watcher,
      household,
      known,
      rememberItems,
      progress,
      reportProgress,
      readProgress,
      startOverride,
      moodLights,
      askingAbout,
      watchParty,
      refresh,
      holdTheScreen,
      isHoldingTheScreen,
    ],
  );

  if (session.isError) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-2 p-8">
        <h1 className="text-2xl font-semibold text-text">Valence is not reachable</h1>
        <p className="text-text-muted">
          The server did not respond. Check that it is running and reload the page.
        </p>
      </main>
    );
  }

  return (
    <LayoutGroup>
      {shell !== null ? (
        <shellContext.Provider value={shell}>
          <Outlet />
        </shellContext.Provider>
      ) : phase !== 'gone' ? null : (
        <ProfileGate
          name={title}
          onSignedIn={() => {
            go({ section: 'home', search: '', inspecting: null, playing: null });
            void refresh();
          }}
        />
      )}

      {phase === 'gone' ? null : (
        <SplashScreen
          name={title}
          label={`Loading ${title}`}
          isReady={!isWaiting}
          marksPlace={MARKS_PLACE}
          hasMark={phase === 'holding'}
          isLeaving={phase === 'fading'}
        />
      )}
    </LayoutGroup>
  );
};

SignedIn.displayName = 'SignedIn';

export { SignedIn };
