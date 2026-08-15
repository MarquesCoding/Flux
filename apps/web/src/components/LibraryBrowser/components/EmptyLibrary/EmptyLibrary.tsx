import { RiFolderOpenLine, RiSearchLine } from '@remixicon/react';
import type { EmptyLibraryProps } from './EmptyLibrary.types';

/**
 * What to say when a library has nothing to show.
 *
 * Three different situations wore one sentence before this — "This library is
 * empty. Scan it to find your media." — which was wrong in two of them. It
 * told somebody whose other libraries are full that they had no media, and it
 * told somebody on a fresh server to scan a library without saying which.
 *
 * So they are separated, and each says the thing that is actually true:
 *
 * - **A search that matched nothing** is not an empty library at all, and
 *   saying "scan it" to somebody who mistyped a title is nonsense.
 * - **An empty library on a server with content** is one library among
 *   several, and the useful thing to know is that the rest are fine — the
 *   scan that is needed is this one's.
 * - **Nothing anywhere** is a server that has not been set up yet, and is the
 *   only one of the three where scanning is the whole answer.
 *
 * Deliberately quiet in every case. An empty shelf is not an error, and
 * drawing it in red would say something has gone wrong when nothing has.
 */
const EmptyLibrary = ({ search, libraryName, hasContentElsewhere }: EmptyLibraryProps) => {
  if (search !== '') {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <RiSearchLine size={28} className="text-text-muted" aria-hidden />

        <p className="text-sm font-medium text-text">Nothing matches “{search}”</p>

        <p className="max-w-sm text-sm text-text-muted">
          Try fewer words, or a different spelling. Search looks at titles rather than at what is
          inside a programme.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <RiFolderOpenLine size={28} className="text-text-muted" aria-hidden />

      <p className="text-sm font-medium text-text">
        {hasContentElsewhere
          ? `Nothing in ${libraryName ?? 'this library'} yet`
          : 'Nothing has been scanned yet'}
      </p>

      <p className="max-w-sm text-sm text-text-muted">
        {hasContentElsewhere
          ? 'Your other libraries have media in them. Scan this one from the admin area, or check that its folder is where Flux expects.'
          : 'Add a library pointing at a folder of media and scan it, and what it finds will show up here.'}
      </p>
    </div>
  );
};

EmptyLibrary.displayName = 'EmptyLibrary';

export { EmptyLibrary };
