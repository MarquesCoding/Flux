import { useQuery } from '@tanstack/react-query';
import { libraryQueries } from '@FluxClient/query/libraryQueries';
import { BookRail } from '@FluxScreens/components/BookRail/BookRail';
import type { BookShelfProps } from './BookShelf.types';

/**
 * Everything there is to read, a shelf at a time.
 *
 * One rail per library rather than one rail for everything, because a household that keeps its manga
 * and its novels apart did that on purpose and a single shelf would undo it.
 *
 * @param onOpen - Told which book somebody wants to read.
 */
const BookShelf = ({ onOpen }: BookShelfProps) => {
  const asked = useQuery(libraryQueries.all());
  const shelves = (asked.data ?? []).filter((library) => library.kind === 'books');

  if (asked.data !== undefined && shelves.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-lg font-medium text-text">Nothing to read yet</p>
        <p className="max-w-prose text-sm text-text-muted">
          Add a library of books from the admin page, point it at a folder of them, and scan it.
        </p>
      </div>
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
