import { SearchArea } from '@FluxScreens/components/SearchArea/SearchArea';
import { usePlace } from '@FluxScreens/navigation/usePlace';
import { useShell } from '@FluxClient/shell/useShell';
import { useFavourites } from '@FluxClient/library/useFavourites';
import { watchedFraction } from '@FluxContracts/schemas/WatchProgress';
import { resumeFor } from '@FluxClient/playback/resumeFor';

/**
 * Searching the whole server, and narrowing what comes back.
 */
const SearchPage = () => {
  const { user, rememberItems, progress, setStartOverride } = useShell();
  const { place, go, replace } = usePlace();
  const favourites = useFavourites(user.id);

  return (
    <SearchArea
      search={place.search}
      onSearchChange={(next) => {
        replace({ search: next });
      }}
      genre={place.genre}
      onGenreChange={(next) => {
        replace({ genre: next });
      }}
      onPlay={(media, startSeconds) => {
        setStartOverride({ mediaId: media.id, seconds: Math.floor(startSeconds) });
        go({ playing: media.id });
      }}
      onInspect={(media) => {
        go({ inspecting: media.id });
      }}
      onItemsLoaded={rememberItems}
      watchedFractionFor={(mediaId) => {
        const found = progress.get(mediaId);

        return found === undefined ? undefined : watchedFraction(found);
      }}
      resumeFor={(mediaId) => resumeFor(progress, mediaId)}
      isKept={favourites.isKept}
      onToggleKept={(media) => {
        favourites.toggle(media.id);
      }}
    />
  );
};

SearchPage.displayName = 'SearchPage';

export { SearchPage };
