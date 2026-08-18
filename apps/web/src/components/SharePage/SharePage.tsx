import { useState } from 'react';
import { ShareArea } from '@FluxWeb/components/ShareArea/ShareArea';
import { VideoPlayer } from '@FluxWeb/components/VideoPlayer/VideoPlayer';
import { usePlace } from '@FluxWeb/navigation/usePlace';
import { reasonIfShareEnded } from '@FluxWeb/sharing/reasonIfShareEnded';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { SharePageProps } from './SharePage.types';

/**
 * What somebody sent a link to, for a guest who is not signed in and has no profile to record
 * anything against. Where they got to is held here for as long as the page lives and nowhere else,
 * since there is nobody to hold it for.
 *
 * A guest cannot be told that their link was withdrawn — the realtime feed wants an account — so the
 * stream failing is what says so. The player asks why before blaming the network, and closing the
 * notice puts them back on the screen that explains what happened.
 *
 * @param name - What this instance is called.
 */
const SharePage = ({ name }: SharePageProps) => {
  const { place } = usePlace();
  const [playing, setPlaying] = useState<MediaSummary | null>(null);
  const [reached, setReached] = useState<Map<string, number>>(new Map());

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
          askWhyItStopped={async () => reasonIfShareEnded(place.shareToken ?? '')}
          onClose={() => {
            setPlaying(null);
          }}
        />
      </main>
    );
  }

  return (
    <ShareArea
      token={place.shareToken ?? ''}
      name={name}
      resumeFor={(mediaId) => reached.get(mediaId) ?? null}
      onPlay={setPlaying}
    />
  );
};

SharePage.displayName = 'SharePage';

export { SharePage };
