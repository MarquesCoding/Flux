import { useQueries, useQuery } from '@tanstack/react-query';
import { Books01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@ValenceUI/Button';
import { NothingHere } from '@ValenceUI/NothingHere';
import { bookQueries } from '@ValenceClient/query/bookQueries';
import { libraryQueries } from '@ValenceClient/query/libraryQueries';
import { BookRail } from '@ValenceScreens/components/BookRail/BookRail';
import type { BookShelfProps } from './BookShelf.types';

/**
 * Everything there is to read, a shelf at a time.
 *
 * One rail per library rather than one rail for everything, because a household that keeps its manga
 * and its novels apart did that on purpose and a single shelf would undo it.
 *
 * @param onOpen - Told which book somebody wants to read.
 */
const BookShelf = ({ onOpen, onAddLibrary }: BookShelfProps) => {
  const asked = useQuery(libraryQueries.all());
  const shelves = (asked.data ?? []).filter((library) => library.kind === 'books');

  const onEachShelf = useQueries({
    queries: shelves.map((library) => bookQueries.inLibrary(library.id)),
  });

  const isCounting = onEachShelf.some((shelf) => shelf.data === undefined && !shelf.isError);
  const hasNothingOnAnyShelf =
    shelves.length > 0 &&
    !isCounting &&
    onEachShelf.every((shelf) => (shelf.data ?? []).length === 0);

  if (asked.data !== undefined && shelves.length === 0) {
    return (
      <NothingHere
        of={Books01Icon}
        title="No book libraries yet"
        detail={
          onAddLibrary === undefined
            ? 'Ask the server admin to add one.'
            : 'Add one to get started.'
        }
        {...(onAddLibrary === undefined
          ? {}
          : {
              action: (
                <Button variant="glossy" onClick={onAddLibrary}>
                  Add a library
                </Button>
              ),
            })}
      />
    );
  }

  if (hasNothingOnAnyShelf) {
    return (
      <NothingHere
        of={Books01Icon}
        title="Nothing to read yet"
        detail={
          onAddLibrary === undefined
            ? 'Ask the server admin to scan it.'
            : 'Scan it, or add files to its folder.'
        }
        {...(onAddLibrary === undefined
          ? {}
          : {
              action: (
                <Button variant="glossy" onClick={onAddLibrary}>
                  Scan it
                </Button>
              ),
            })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {shelves.map((library) => (
        <BookRail key={library.id} libraryId={library.id} title={library.name} onOpen={onOpen} />
      ))}
    </div>
  );
};

BookShelf.displayName = 'BookShelf';

export { BookShelf };
