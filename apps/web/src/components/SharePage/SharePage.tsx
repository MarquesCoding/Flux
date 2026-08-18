import { useEffect, useState } from 'react';
import { ShareArea } from '@FluxWeb/components/ShareArea/ShareArea';
import { VideoPlayer } from '@FluxWeb/components/VideoPlayer/VideoPlayer';
import { usePlace } from '@FluxWeb/navigation/usePlace';
import { reasonIfShareEnded } from '@FluxWeb/sharing/reasonIfShareEnded';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { SharePageProps } from './SharePage.types';

const ASK_EVERY_MILLISECONDS = 5000;

/**
 * What somebody sent a link to, for a guest who is not signed in and has no profile to record
 * anything against. Where they got to is held here for as long as the page lives and nowhere else,
 * since there is nobody to hold it for.
 *
 * A guest cannot be told that their link has been withdrawn: the realtime feed wants an account, and
 * a link is deliberately never a live feed of the household. So this asks instead, while something
 * is playing, and takes the picture away the moment the answer is that the link has ended — rather
 * than letting a guest watch out whatever the buffer holds and then reporting it as a fault in the
 * stream, which is a decision somebody made described as a failure.
 *
 * Asking only while playing is the point: a guest reading the page has nothing to interrupt, and the
 * screen they are on asks for itself when it opens.
 *
 * @param name - What this instance is called.
 * @param askEveryMilliseconds - How often to check the link still works while something is playing.
 */
const SharePage = ({ name, askEveryMilliseconds = ASK_EVERY_MILLISECONDS }: SharePageProps) => {
  const { place } = usePlace();
  const [playing, setPlaying] = useState<MediaSummary | null>(null);
  const [reached, setReached] = useState<Map<string, number>>(new Map());
  const [ended, setEnded] = useState<string | null>(null);
  const token = place.shareToken ?? '';

  useEffect(() => {
    if (playing === null) {
      return;
    }

    let abandoned = false;

    const ask = async () => {
      const reason = await reasonIfShareEnded(token);

      if (!abandoned && reason !== null) {
        setEnded(reason);
        setPlaying(null);
      }
    };

    const timer = setInterval(() => {
      void ask();
    }, askEveryMilliseconds);

    return () => {
      abandoned = true;
      clearInterval(timer);
    };
  }, [playing, token, askEveryMilliseconds]);

  if (playing !== null) {
    return (
      <main className="fixed inset-0 z-40 flex flex-col bg-black">
        <VideoPlayer
          media={playing}
          startSeconds={reached.get(playing.id) ?? 0}
          isImmersive
          onProgress={(positionSeconds) => {
            setReached((held) => new Map(held).set(playing.id, positionSeconds));
          }}
          onClose={() => {
            setPlaying(null);
          }}
        />
      </main>
    );
  }

  return (
    <ShareArea
      token={token}
      name={name}
      endedReason={ended}
      resumeFor={(mediaId) => reached.get(mediaId) ?? null}
      onPlay={setPlaying}
    />
  );
};

SharePage.displayName = 'SharePage';

export { SharePage };
