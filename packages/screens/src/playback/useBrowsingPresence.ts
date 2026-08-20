import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { profileQueries } from '@FluxClient/query/profileQueries';
import { isTheDesktopClient, nowWatching } from '@FluxScreens/desktop/theDesktopShell';

/**
 * Says that somebody has Flux open, so their status stands between the things they watch.
 *
 * This sits above the player rather than inside it, because it has to outlive one: somebody who
 * finishes an episode and goes back to the library has not stopped using Flux, and a status that
 * appeared and vanished around each episode would say less than one that stays.
 *
 * The player says something more specific while it is playing, and says this again on its way out.
 * Both go to the same place and the last one said is the one shown, so the two need no agreement
 * beyond saying the same thing about the same moment.
 *
 * Nothing is said at all where the profile did not ask for it, or in a browser, which has nothing to
 * say it to.
 */
const useBrowsingPresence = (): void => {
  const asked = useQuery(profileQueries.watching());
  const isAllowed = asked.data?.showsWhatIamWatching ?? false;

  useEffect(() => {
    if (!isAllowed || !isTheDesktopClient()) {
      nowWatching(null);

      return;
    }

    nowWatching({ kind: 'browsing' });

    return () => {
      nowWatching(null);
    };
  }, [isAllowed]);
};

export { useBrowsingPresence };
