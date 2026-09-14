import { LibraryBrowser } from '@ValenceScreens/components/LibraryBrowser/LibraryBrowser';
import { showSlug } from '@ValenceCore/functions/showSlug';
import { usePlace } from '@ValenceScreens/navigation/usePlace';
import { useShell } from '@ValenceClient/shell/useShell';
import { useFavourites } from '@ValenceClient/library/useFavourites';
import { useWhatIMayDo } from '@ValenceClient/session/useWhatIMayDo';

/**
 * The front of the server: a hero drawn from every library, and the rows of everything to watch.
 */
const HomePage = () => {
  const { title, user, rememberItems, setStartOverride, setMoodLights, holdTheScreen } = useShell();
  const { place, go } = usePlace();
  const favourites = useFavourites(user.id);
  const { mayAdminister } = useWhatIMayDo();

  return (
    <LibraryBrowser
      name={title}
      search={place.search}
      {...(mayAdminister
        ? {
            onAddLibrary: () => {
              go({ admin: 'libraries' });
            },
          }
        : {})}
      onPlay={(media) => {
        go({ inspecting: media.id });
      }}
      onShow={(seriesId) => {
        go({ show: seriesId });
      }}
      onWatch={(media, startSeconds) => {
        setStartOverride({ mediaId: media.id, seconds: Math.floor(startSeconds) });
        go({ playing: media.id });
      }}
      onItemsLoaded={rememberItems}
      onReading={holdTheScreen}
      hasHero
      onPalette={setMoodLights}
      onOpenShow={(media) => {
        const series = media.seriesId ?? showSlug(media.seriesTitle ?? '');

        if (series !== '') {
          go({ show: series });
        }
      }}
      isKept={favourites.isKept}
      onToggleKept={(media) => {
        favourites.toggle(media.id);
      }}
    />
  );
};

HomePage.displayName = 'HomePage';

export { HomePage };
