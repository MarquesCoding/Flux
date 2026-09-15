import { useEffect, useRef } from 'react';
import { MotionConfig } from 'motion/react';
import { useOfflineMode } from '@ValenceClient/offline/useOfflineMode';
import { useAppliedTheme } from '@ValenceScreens/theme/useAppliedTheme';
import { useAppliedMotion } from '@ValenceScreens/motion/useAppliedMotion';
import { sendWatchedOffline } from '@ValenceClient/offline/watchedOffline';
import { App } from '@ValenceScreens/components/App/App';
import { OfflineApp } from '@ValenceScreens/components/OfflineApp/OfflineApp';
import type { ValenceRootProps } from './ValenceRoot.types';

/**
 * Which of the two applications this is: the ordinary one, or the small one for when there is no
 * server.
 *
 * The choice is made out here rather than inside the ordinary application, and that is the whole
 * reason this exists. Deciding it further in would mean the ordinary application mounting first —
 * opening a socket, asking whether the server has been set up, asking who is watching — and every
 * one of those failing on the way to drawing something that never needed them. Choosing before any
 * of it mounts means offline costs nothing and asks nobody.
 *
 * Coming back is the moment anything watched on the aeroplane is told to the server, because it is
 * the first moment there is a server to tell.
 *
 * The chosen theme is put on the document from here, because this is the outermost thing either
 * application has in common — and from the one screen that is drawn before this exists, which is a
 * client asking which server is yours.
 *
 * @param initialTitle - What this instance is called.
 */
const ValenceRoot = ({ initialTitle }: ValenceRootProps) => {
  const { isOffline } = useOfflineMode();
  const wasOffline = useRef(isOffline);

  useAppliedTheme();

  const howMuchMovement = useAppliedMotion();

  useEffect(() => {
    if (wasOffline.current && !isOffline) {
      void sendWatchedOffline();
    }

    wasOffline.current = isOffline;
  }, [isOffline]);

  return (
    <MotionConfig reducedMotion={howMuchMovement}>
      {isOffline ? <OfflineApp title={initialTitle} /> : <App initialTitle={initialTitle} />}
    </MotionConfig>
  );
};

ValenceRoot.displayName = 'ValenceRoot';

export { ValenceRoot };
