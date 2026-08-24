import { useQuery } from '@tanstack/react-query';
import { BooksIcon } from '@phosphor-icons/react';
import { Button } from '@ValenceUI/Button';
import { NothingHere } from '@ValenceUI/NothingHere';
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

  if (asked.data !== undefined && shelves.length === 0) {
    return (
      <NothingHere
        of={BooksIcon}
        title="Nothing to read yet"
        detail={
          onAddLibrary === undefined
            ? 'Ask whoever runs this server to add one.'
            : 'Point a library at a folder of books and scan it.'
        }
        {...(onAddLibrary === undefined
          ? {}
          : {
              action: (
                <Button variant="glossy" isPill onClick={onAddLibrary}>
                  Add a library
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
