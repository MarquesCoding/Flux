import { useQuery } from '@tanstack/react-query';
import { Rail } from '@FluxUI/Rail';
import { MediaCard } from '@FluxUI/MediaCard';
import { Skeleton } from '@FluxUI/Skeleton';
import { CouldNotRead } from '@FluxUI/CouldNotRead';
import { bookCoverUrl } from '@FluxClient/books/fetchBooks';
import { bookQueries } from '@FluxClient/query/bookQueries';
import type { BookRailProps } from './BookRail.types';

const WAITING = 6;

/**
 * One shelf of books, drawn the way the rest of the library is drawn.
 *
 * The cards are the poster shape rather than the wide one, because a book is taller than it is
 * across: the covers in this library measure 3311 by 4717, which is a shade taller than two by three
 * and nothing like the shape a film is shown in.
 *
 * The cover is the first page of the first chapter, which is what a comic archive actually holds —
 * there is no separate artwork in one, and asking a catalogue for it is a different feature.
 *
 * @param libraryId - Which shelf.
 * @param title - What to call it.
 * @param onOpen - Told which book somebody wants to read.
 */
const BookRail = ({ libraryId, title, onOpen }: BookRailProps) => {
  const asked = useQuery(bookQueries.inLibrary(libraryId));

  if (asked.isError) {
    return (
      <Rail title={title}>
        <CouldNotRead
          what="That shelf"
          isTryingAgain={asked.isFetching}
          onTryAgain={() => {
            void asked.refetch();
          }}
        />
      </Rail>
    );
  }

  if (asked.data === undefined) {
    return (
      <Rail title={title}>
        {Array.from({ length: WAITING }, (_, at) => (
          <Skeleton key={at} className="aspect-[2/3] w-40 shrink-0 rounded-lg" />
        ))}
      </Rail>
    );
  }

  if (asked.data.length === 0) {
    return null;
  }

  return (
    <Rail title={title}>
      {asked.data.map((book) => (
        <MediaCard
          key={book.id}
          title={book.title}
          shape="poster"
          imageUrl={bookCoverUrl(book.id)}
          subtitle={
            book.chapterCount === 1 ? '1 chapter' : `${book.chapterCount.toString()} chapters`
          }
          {...(book.year === null ? {} : { eyebrow: book.year.toString() })}
          onSelect={() => {
            onOpen(book);
          }}
          className="w-40 shrink-0"
        />
      ))}
    </Rail>
  );
};

BookRail.displayName = 'BookRail';

export { BookRail };
