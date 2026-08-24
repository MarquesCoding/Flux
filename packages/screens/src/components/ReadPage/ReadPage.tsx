import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@ValenceUI/Spinner';
import { CouldNotRead } from '@ValenceUI/CouldNotRead';
import { bookQueries } from '@ValenceClient/query/bookQueries';
import { saveReadingProgress } from '@ValenceClient/books/fetchBooks';
import { PageReader } from '@ValenceScreens/components/PageReader/PageReader';

/**
 * Reading one book.
 *
 * Which chapter opens is where somebody left off, and where in it is the page they were on. A shelf
 * somebody returns to should carry on rather than start again, and the alternative — always opening
 * at chapter one, page one — makes a thirty-eight volume series unusable after the first evening.
 *
 * The reader is given the chapter as its key, so moving to another chapter is a new reader rather
 * than the same one told to move. A reader that kept its place across that would open the next
 * chapter on page ninety.
 */
const ReadPage = () => {
  const { bookId } = useParams({ strict: false });
  const go = useNavigate();
  const id = bookId ?? '';

  const asked = useQuery(bookQueries.one(id));
  const read = useQuery(bookQueries.progress(id));
  const [chosen, setChosen] = useState<string | null>(null);

  const chapters = useMemo(() => asked.data?.chapters ?? [], [asked.data]);

  const furthest = useMemo(() => {
    const held = read.data ?? [];
    const latest = [...held].sort(
      (one, other) => Date.parse(other.updatedAt) - Date.parse(one.updatedAt),
    )[0];

    return latest ?? null;
  }, [read.data]);

  const chapterId = chosen ?? furthest?.chapterId ?? chapters[0]?.id ?? '';
  const startAtPage = chosen === null && furthest !== null ? (furthest.pageNumber ?? 0) : 0;

  const remember = useCallback(
    (page: number, isFinished: boolean) => {
      void saveReadingProgress(id, chapterId, page, isFinished);
    },
    [chapterId, id],
  );

  if (asked.isError) {
    return (
      <CouldNotRead
        what="That book"
        isTryingAgain={asked.isFetching}
        onTryAgain={() => {
          void asked.refetch();
        }}
      />
    );
  }

  if (asked.data === undefined || asked.data === null || read.data === undefined) {
    return (
      <div className="flex h-dvh items-center justify-center bg-shade">
        <Spinner label="Opening the book" />
      </div>
    );
  }

  if (chapterId === '') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 bg-shade text-center">
        <p className="text-lg font-medium text-on-scrim">Nothing in this book yet</p>
        <p className="text-sm text-on-scrim/70">
          Scanning the library again may find its chapters.
        </p>
      </div>
    );
  }

  return (
    <PageReader
      key={chapterId}
      book={asked.data.book}
      chapters={chapters}
      chapterId={chapterId}
      startAtPage={startAtPage}
      onChapterChange={setChosen}
      onPageChange={remember}
      onClose={() => {
        void go({ to: '/read' });
      }}
    />
  );
};

ReadPage.displayName = 'ReadPage';

export { ReadPage };
