import { LibraryBrowser } from '@ValenceScreens/components/LibraryBrowser/LibraryBrowser';
import { showSlug } from '@ValenceCore/functions/showSlug';
import { usePlace } from '@ValenceScreens/navigation/usePlace';
import { useShell } from '@ValenceClient/shell/useShell';
import { useFavourites } from '@ValenceClient/library/useFavourites';

/**
 * The front of the server: a hero drawn from every library, and the rows of one of them.
 */
const HomePage = () => {
  const { title, user, rememberItems, setStartOverride, setMoodLights } = useShell();
  const { place, go, replace } = usePlace();
  const favourites = useFavourites(user.id);

  return (
    <LibraryBrowser
      name={title}
      search={place.search}
      libraryId={place.library}
      onLibraryChange={(libraryId) => {
        replace({ library: libraryId });
      }}
      {...(user.role === 'admin'
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
