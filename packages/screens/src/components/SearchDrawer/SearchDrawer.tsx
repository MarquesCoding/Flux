import { Icon } from '@ValenceUI/Icon';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@ValenceUI/Button';
import { Drawer } from '@ValenceUI/Drawer';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { SearchArea } from '@ValenceScreens/components/SearchArea/SearchArea';
import { usePlace } from '@ValenceScreens/navigation/usePlace';
import { useShell } from '@ValenceClient/shell/useShell';
import { useFavourites } from '@ValenceClient/library/useFavourites';
import { watchedFraction } from '@ValenceContracts/schemas/WatchProgress';
import { resumeFor } from '@ValenceClient/playback/resumeFor';
import type { SearchDrawerProps } from './SearchDrawer.types';

/**
 * Searching the whole server, raised over whatever the viewer was looking at rather than taking them
 * to a page of its own.
 *
 * @param isOpen - Whether the address has it open.
 * @param onClose - Told it was dismissed.
 */
const SearchDrawer = ({ isOpen, onClose }: SearchDrawerProps) => {
  const { user, rememberItems, progress, setStartOverride } = useShell();
  const { place, go, replace } = usePlace();
  const favourites = useFavourites(user.id);

  return (
    <Drawer label="Search" isOpen={isOpen} onClose={onClose}>
      <DialogTitle title="Search">
        <Button variant="ghost" size="sm" isIconOnly label="Close" onClick={onClose}>
          <Icon of={Cancel01Icon} size={16} />
        </Button>
      </DialogTitle>

      <DialogContent className="px-0 py-0">
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
      </DialogContent>
    </Drawer>
  );
};

SearchDrawer.displayName = 'SearchDrawer';

export { SearchDrawer };
