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
 * @param canManage - Whether whoever is reading this could do anything about it.
 */
const EmptyLibrary = ({
  search,
  libraryName,
  hasContentElsewhere,
  canManage = false,
}: EmptyLibraryProps) => {
  if (search !== '') {
    return (
      <NothingHere
        of={MagnifyingGlassIcon}
        title={`Nothing matches “${search}”`}
        detail="Try fewer words, or a different spelling."
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
        canManage
          ? hasContentElsewhere
            ? 'Scan it from the admin area, or check its folder.'
            : 'Add a library and scan it.'
          : hasContentElsewhere
            ? 'Ask whoever runs this server to scan it.'
            : 'Ask whoever runs this server to scan one.'
      }
    />
  );
};

EmptyLibrary.displayName = 'EmptyLibrary';

export { EmptyLibrary };
