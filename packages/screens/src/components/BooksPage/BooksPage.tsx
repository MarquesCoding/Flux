import { useNavigate } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { revealTransition, revealVariants, staggerVariants } from '@ValenceUI/animations/reveal';
import { usePlace } from '@ValenceScreens/navigation/usePlace';
import { useWhatIMayDo } from '@ValenceClient/session/useWhatIMayDo';
import { BookShelf } from '@ValenceScreens/components/BookShelf/BookShelf';

/**
 * Everything there is to read.
 *
 * Choosing a book opens it rather than showing a page about it. What somebody wants from a shelf is
 * to be reading, and the chapters are in the reader's own menu — a screen in between would be a
 * screen everybody passes through on the way to the same place.
 *
 * Laid out as the other sections are: its heading is there for anybody reading the page rather than
 * looking at it, since the bar along the top already says where you are, and a banner saying it
 * again only pushed the books further down.
 */
const BooksPage = () => {
  const go = useNavigate();
  const { mayAdminister } = useWhatIMayDo();
  const { go: goWithin } = usePlace();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.main
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      className="flex flex-col gap-6 px-5 pt-6 pb-16 sm:px-10"
    >
      <h1 className="sr-only">Books</h1>

      <motion.section
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion)}
        aria-label="Books"
        className="flex flex-col gap-5"
      >
        <BookShelf
          onOpen={(book) => {
            void go({ to: '/read/$bookId', params: { bookId: book.id } });
          }}
          {...(mayAdminister
            ? {
                onAddLibrary: () => {
                  goWithin({ admin: 'libraries' });
                },
              }
            : {})}
        />
      </motion.section>
    </motion.main>
  );
};

BooksPage.displayName = 'BooksPage';

export { BooksPage };
