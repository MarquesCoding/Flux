import { useEffect, useRef } from 'react';
import { setHolding } from '@ValenceClient/downloads/fetchDownloads';
import { useHeldFiles } from '@ValenceClient/downloads/useHeldFiles';
import type { DownloadQuality } from '@ValenceContracts/schemas/Download';

/**
 * Tells the server what this device is actually holding, as it changes.
 *
 * Worth knowing for one reason: somebody with a film on their laptop and the same film on their
 * phone is asking the server to keep one prepared copy, not two, and somebody who has let go of
 * every copy is asking it to keep none. Without this the server is holding renditions for devices
 * that threw them away months ago.
 *
 * A hint and never a fact, and the server treats it as one. This is a device volunteering something
 * about itself over a network that may not be there, so it is always incomplete: something let go of
 * while offline is reported as gone the next time this device is running and connected, and
 * something let go of on a laptop that was then thrown into the sea is never reported at all. A
 * server that refused a download because a holding said one already existed would be refusing on the
 * strength of that.
 *
 * Everything held is re-asserted on the way up rather than only what changed. The record is a
 * statement about now rather than a log of what happened, and a device that was reinstalled, or
 * whose server lost its database, should say what is true rather than assume it was believed.
 */
const useTellTheServerWhatIsHeld = (): void => {
  const held = useHeldFiles();
  const told = useRef(new Map<string, { mediaId: string; quality: DownloadQuality }>());

  useEffect(() => {
    const here = held.filter((file) => file.state === 'here');
    const nowHeld = new Set(here.map((file) => `${file.mediaId}:${file.quality}`));

    for (const file of here) {
      const key = `${file.mediaId}:${file.quality}`;

      if (!told.current.has(key)) {
        told.current.set(key, { mediaId: file.mediaId, quality: file.quality });

        void setHolding(file.mediaId, file.quality, true);
      }
    }

    for (const [key, what] of told.current) {
      if (!nowHeld.has(key)) {
        told.current.delete(key);

        void setHolding(what.mediaId, what.quality, false);
      }
    }
  }, [held]);
};

export { useTellTheServerWhatIsHeld };
