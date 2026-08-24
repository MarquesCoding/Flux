import { FolderOpenIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { NothingHere } from '@ValenceUI/NothingHere';
import type { EmptyLibraryProps } from './EmptyLibrary.types';

/**
 * Says why there is nothing on screen, which is three different situations and three different
 * answers: a search that matched nothing, one library that is empty while others are not, and a
 * server with nothing scanned anywhere. Only the last is a reason to talk about scanning.
 *
 * @param search - What was searched for, where anything was.
 * @param libraryName - The library being looked at, where one is chosen.
 * @param hasContentElsewhere - Whether any other library has anything in it.
 */
const EmptyLibrary = ({ search, libraryName, hasContentElsewhere }: EmptyLibraryProps) => {
  if (search !== '') {
    return (
      <NothingHere
        of={MagnifyingGlassIcon}
        title={`Nothing matches “${search}”`}
        detail="Try fewer words, or a different spelling. Search looks at titles rather than at what is inside a programme."
      />
    );
  }

  return (
    <NothingHere
      of={FolderOpenIcon}
      title={
        hasContentElsewhere
          ? `Nothing in ${libraryName ?? 'this library'} yet`
          : 'Nothing has been scanned yet'
      }
      detail={
        hasContentElsewhere
          ? 'Your other libraries have media in them. Scan this one from the admin area, or check that its folder is where Valence expects.'
          : 'Add a library pointing at a folder of media and scan it, and what it finds will show up here.'
      }
    />
  );
};

EmptyLibrary.displayName = 'EmptyLibrary';

export { EmptyLibrary };
