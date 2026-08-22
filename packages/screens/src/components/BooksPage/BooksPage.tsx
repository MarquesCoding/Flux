import { useNavigate } from '@tanstack/react-router';
import { BookShelf } from '@ValenceScreens/components/BookShelf/BookShelf';

/**
 * Everything there is to read.
 *
 * Choosing a book opens it rather than showing a page about it. What somebody wants from a shelf is
 * to be reading, and the chapters are in the reader's own menu — a screen in between would be a
 * screen everybody passes through on the way to the same place.
 */
const BooksPage = () => {
  const go = useNavigate();

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 py-6">
      <BookShelf
        onOpen={(book) => {
          void go({ to: '/read/$bookId', params: { bookId: book.id } });
        }}
      />
    </main>
  );
};

BooksPage.displayName = 'BooksPage';

export { BooksPage };
