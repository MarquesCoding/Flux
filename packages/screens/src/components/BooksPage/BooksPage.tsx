import { useNavigate } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { revealTransition, revealVariants, staggerVariants } from '@ValenceUI/animations/reveal';
import { usePlace } from '@ValenceScreens/navigation/usePlace';
import { useShell } from '@ValenceClient/shell/useShell';
import { BookShelf } from '@ValenceScreens/components/BookShelf/BookShelf';

/**
 * Everything there is to read.
 *
 * Choosing a book opens it rather than showing a page about it. What somebody wants from a shelf is
 * to be reading, and the chapters are in the reader's own menu — a screen in between would be a
 * screen everybody passes through on the way to the same place.
 *
 * Named and laid out as the other sections are, down to the heading it carries and the space above
 * it. This was the one page of the six arriving without a title, which read as a different
 * application rather than as the same one showing books.
 */
const BooksPage = () => {
  const go = useNavigate();
  const { user } = useShell();
  const { go: goWithin } = usePlace();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.main
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      className="flex flex-col gap-8 px-5 pt-24 pb-16 sm:px-10"
    >
      <motion.header
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion, 'heavy')}
        className="flex flex-col gap-2"
      >
        <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">Books</h1>

        <p className="text-text-muted">Everything there is to read.</p>
      </motion.header>

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
          {...(user.role === 'admin'
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
