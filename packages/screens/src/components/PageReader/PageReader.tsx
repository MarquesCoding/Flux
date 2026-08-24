import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListIcon, XIcon } from '@phosphor-icons/react';
import { Button } from '@ValenceUI/Button';
import { Icon } from '@ValenceUI/Icon';
import { OptionMenu } from '@ValenceUI/OptionMenu';
import { Slider } from '@ValenceUI/Slider';
import { bookPageUrl } from '@ValenceClient/books/fetchBooks';
import { groupHolding, spreadsFor } from '@ValenceScreens/reading/spreadsFor';
import {
  readReaderPreferences,
  writeReaderPreferences,
} from '@ValenceScreens/reading/readerPreferences';
import type { ReaderPreferences } from '@ValenceScreens/reading/readerPreferences';
import { CLOSEST, distanceBetween, heldWithin, scaleFrom } from '@ValenceScreens/reading/pinch';
import type { PageReaderProps } from './PageReader.types';

const CHROME_LINGERS_MS = 2600;

const A_SWIPE = 48;

const PRELOAD = 4;

const WIDEST = 3840;

const A_LOOK = 2.5;

/**
 * How wide to ask for a page, in real pixels rather than the ones a browser counts in.
 *
 * @param across - How many pages are shown at once.
 * @returns The width to ask the server for.
 */
const widthFor = (across: number): number => {
  const screen = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const density = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio, 3);

  return Math.min(Math.round((screen * density) / Math.max(across, 1)), WIDEST);
};

/**
 * Reads a book that was paginated before it ever reached Valence — a comic, a manga, a scanned volume.
 *
 * The chrome is not there unless it is wanted. A page of a book is the whole point of the screen, so
 * the controls hide themselves and come back on a tap or a moved pointer, the way the player already
 * behaves. Everything they offer has a key and a gesture too, because somebody reading a volume does
 * not want to reach for a control four hundred times.
 *
 * Turning is direction-aware. Manga is read right to left, so the right of the screen and the left
 * arrow both mean forward, and a reader that got this the wrong way round would be unusable rather
 * than merely wrong.
 *
 * Pages are asked for at the width they will be drawn, and the next few are fetched before they are
 * turned to, so a turn is a picture already in hand rather than a wait.
 *
 * A page can be pinched into and dragged around, because a page that fits a phone is a page whose
 * lettering does not. While it is held larger a drag moves it rather than turning, which is the only
 * sensible reading of the gesture, and turning the page puts it back — somebody who zoomed into a
 * corner does not want the next page to open in that corner.
 *
 * @param book - The book being read.
 * @param chapters - Everything in it, so one can be moved to from here.
 * @param chapterId - Which chapter is open.
 * Where it opens is settled once, when it is first shown. A reader whose place was recalculated as
 * it went would jump under somebody the moment a wide page loaded and the pairing shifted — so the
 * screen showing this gives it a key of the chapter, and opening another chapter is a new reader
 * rather than the same one told to move.
 *
 * @param startAtPage - Where to open, where somebody has been here before.
 * @param onChapterChange - Told when another chapter is chosen.
 * @param onPageChange - Told where somebody is up to, for remembering.
 * @param onClose - Told to leave.
 */
const PageReader = ({
  book,
  chapters,
  chapterId,
  startAtPage = 0,
  onChapterChange,
  onPageChange,
  onClose,
}: PageReaderProps) => {
  const chapter = chapters.find((one) => one.id === chapterId) ?? null;
  const pageCount = chapter?.pageCount ?? 0;

  const asLeft = useMemo(() => readReaderPreferences(book.direction), [book.direction]);
  const [settings, setSettings] = useState<ReaderPreferences>(asLeft);
  const [wide, setWide] = useState<ReadonlySet<number>>(new Set());
  const [at, setAt] = useState(() =>
    groupHolding(
      spreadsFor({
        pageCount,
        isDouble: asLeft.isDouble,
        isOffset: asLeft.isOffset,
        wide: new Set(),
      }),
      startAtPage,
    ),
  );
  const [isChromeShown, setIsChromeShown] = useState(true);
  const startedAt = useRef<number | null>(null);
  const hideAt = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scale, setScale] = useState(CLOSEST);
  const [moved, setMoved] = useState({ x: 0, y: 0 });
  const pinch = useRef<{ from: number; base: number } | null>(null);
  const dragged = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null);

  const groups = useMemo(
    () =>
      spreadsFor({
        pageCount,
        isDouble: settings.isDouble,
        isOffset: settings.isOffset,
        wide,
      }),
    [pageCount, settings.isDouble, settings.isOffset, wide],
  );

  const showing = groups[Math.min(at, Math.max(groups.length - 1, 0))] ?? [];
  const isLast = at >= groups.length - 1;
  const first = showing[0];
  const report = useRef(onPageChange);

  useEffect(() => {
    report.current = onPageChange;
  });

  useEffect(() => {
    if (first !== undefined) {
      report.current?.(first, isLast);
    }
  }, [first, isLast]);

  useEffect(() => {
    setScale(CLOSEST);
    setMoved({ x: 0, y: 0 });
  }, [first]);

  const wake = useCallback(() => {
    setIsChromeShown(true);

    if (hideAt.current !== null) {
      clearTimeout(hideAt.current);
    }

    hideAt.current = setTimeout(() => {
      setIsChromeShown(false);
    }, CHROME_LINGERS_MS);
  }, []);

  useEffect(() => {
    wake();

    return () => {
      if (hideAt.current !== null) {
        clearTimeout(hideAt.current);
      }
    };
  }, [wake]);

  const ordering = useMemo(
    () => [...chapters].sort((one, other) => one.number - other.number),
    [chapters],
  );

  const which = ordering.findIndex((one) => one.id === chapterId);

  const turn = useCallback(
    (by: number) => {
      wake();

      setAt((was) => {
        const next = was + by;

        if (next > groups.length - 1) {
          const after = ordering[which + 1];

          if (after !== undefined) {
            onChapterChange(after.id);
          }

          return was;
        }

        if (next < 0) {
          const before = ordering[which - 1];

          if (before !== undefined) {
            onChapterChange(before.id);
          }

          return was;
        }

        return next;
      });
    },
    [groups.length, onChapterChange, ordering, wake, which],
  );

  const forward = useCallback(() => {
    turn(1);
  }, [turn]);

  const back = useCallback(() => {
    turn(-1);
  }, [turn]);

  useEffect(() => {
    const isRightToLeft = settings.direction === 'rightToLeft';

    const pressed = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();

        return;
      }

      if (event.key === 'ArrowLeft') {
        (isRightToLeft ? forward : back)();
      }

      if (event.key === 'ArrowRight') {
        (isRightToLeft ? back : forward)();
      }

      if (event.key === 'ArrowDown' || event.key === ' ' || event.key === 'PageDown') {
        forward();
      }

      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        back();
      }
    };

    window.addEventListener('keydown', pressed);

    return () => {
      window.removeEventListener('keydown', pressed);
    };
  }, [back, forward, onClose, settings.direction]);

  const change = (changed: Partial<ReaderPreferences>) => {
    const next = { ...settings, ...changed };

    setSettings(next);
    writeReaderPreferences(next);
    wake();
  };

  const noted = (page: number, element: HTMLImageElement) => {
    if (element.naturalWidth <= element.naturalHeight) {
      return;
    }

    setWide((was) => (was.has(page) ? was : new Set([...was, page])));
  };

  const preloading = useMemo(
    () =>
      groups
        .slice(at + 1, at + 1 + PRELOAD)
        .flat()
        .map((page) => bookPageUrl(book.id, chapterId, page, widthFor(showing.length))),
    [groups, at, book.id, chapterId, showing.length],
  );

  const ordered = settings.direction === 'rightToLeft' ? [...showing].reverse() : showing;

  return (
    <div
      className="valence-below-the-bar z-50 flex flex-col bg-shade"
      onPointerMove={wake}
      onTouchStart={(event) => {
        const [one, other] = [event.touches[0], event.touches[1]];

        if (one !== undefined && other !== undefined) {
          pinch.current = { from: distanceBetween(one, other), base: scale };
          startedAt.current = null;

          return;
        }

        if (scale > CLOSEST && one !== undefined) {
          dragged.current = { x: one.clientX, y: one.clientY, from: moved };

          return;
        }

        startedAt.current = one?.clientX ?? null;
      }}
      onTouchMove={(event) => {
        const [one, other] = [event.touches[0], event.touches[1]];
        const pinching = pinch.current;

        if (pinching !== null && one !== undefined && other !== undefined) {
          setScale(scaleFrom(pinching.base, pinching.from, distanceBetween(one, other)));

          return;
        }

        const dragging = dragged.current;

        if (dragging !== null && one !== undefined) {
          const across = typeof window === 'undefined' ? 0 : window.innerWidth;
          const down = typeof window === 'undefined' ? 0 : window.innerHeight;

          setMoved({
            x: heldWithin(dragging.from.x + (one.clientX - dragging.x), across, scale),
            y: heldWithin(dragging.from.y + (one.clientY - dragging.y), down, scale),
          });
        }
      }}
      onTouchEnd={(event) => {
        const from = startedAt.current;
        const to = event.changedTouches[0]?.clientX ?? null;

        pinch.current = null;
        dragged.current = null;
        startedAt.current = null;

        if (from === null || to === null || Math.abs(to - from) < A_SWIPE) {
          return;
        }

        const wentLeft = to < from;
        const isRightToLeft = settings.direction === 'rightToLeft';

        (wentLeft === isRightToLeft ? back : forward)();
      }}
      onDoubleClick={() => {
        setScale((was) => (was > CLOSEST ? CLOSEST : A_LOOK));
        setMoved({ x: 0, y: 0 });
        wake();
      }}
    >
      <header
        className={[
          'absolute inset-x-0 top-0 z-10 flex items-center gap-3 p-3',
          'bg-gradient-to-b from-shade/80 to-transparent',
          'transition-opacity duration-[var(--duration-fast)]',
          isChromeShown ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      >
        <Button variant="ghost" size="sm" isPill onClick={onClose} aria-label="Close the reader">
          <Icon of={XIcon} size={18} />
        </Button>

        <span className="min-w-0 flex-1 truncate text-sm text-on-scrim">
          {book.title} — {chapter?.title ?? ''}
        </span>

        <OptionMenu
          label="How to read"
          trigger={
            <Button variant="ghost" size="sm" isPill>
              <Icon of={ListIcon} size={18} />
            </Button>
          }
          groups={[
            {
              name: 'Pages',
              selectedId: settings.isDouble ? 'double' : 'single',
              onSelect: (id) => {
                change({ isDouble: id === 'double' });
              },
              options: [
                { id: 'single', label: 'One page' },
                { id: 'double', label: 'Two pages' },
              ],
            },
            {
              name: 'Spreads',
              selectedId: settings.isOffset ? 'offset' : 'aligned',
              onSelect: (id) => {
                change({ isOffset: id === 'offset' });
              },
              options: [
                {
                  id: 'offset',
                  label: 'Cover on its own',
                  detail: 'Pairing starts after page one',
                },
                { id: 'aligned', label: 'Pair from the first page' },
              ],
            },
            {
              name: 'Fit',
              selectedId: settings.fit,
              onSelect: (id) => {
                change({ fit: id === 'width' ? 'width' : id === 'height' ? 'height' : 'both' });
              },
              options: [
                { id: 'both', label: 'Fit the screen' },
                { id: 'width', label: 'Fit the width' },
                { id: 'height', label: 'Fit the height' },
              ],
            },
            {
              name: 'Chapter',
              selectedId: chapterId,
              onSelect: onChapterChange,
              options: ordering.map((one) => ({
                id: one.id,
                label: one.title,
                ...(one.pageCount === null ? {} : { detail: `${one.pageCount.toString()} pages` }),
              })),
            },
            {
              name: 'Direction',
              selectedId: settings.direction,
              onSelect: (id) => {
                change({ direction: id === 'rightToLeft' ? 'rightToLeft' : 'leftToRight' });
              },
              options: [
                { id: 'rightToLeft', label: 'Right to left', detail: 'How manga is read' },
                { id: 'leftToRight', label: 'Left to right' },
              ],
            },
          ]}
        />
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            transform: `translate3d(${moved.x.toString()}px, ${moved.y.toString()}px, 0) scale(${scale.toString()})`,
            transition:
              pinch.current === null && dragged.current === null ? 'transform 120ms' : 'none',
          }}
        >
          {ordered.map((page) => (
            <img
              key={page}
              src={bookPageUrl(book.id, chapterId, page, widthFor(showing.length))}
              alt={`Page ${(page + 1).toString()}`}
              onLoad={(event) => {
                noted(page, event.currentTarget);
              }}
              className={[
                'select-none',
                settings.fit === 'width' ? 'w-full object-contain' : '',
                settings.fit === 'height' ? 'h-full object-contain' : '',
                settings.fit === 'both' ? 'max-h-full max-w-full object-contain' : '',
              ].join(' ')}
            />
          ))}
        </div>

        <div className="absolute inset-y-0 left-0 flex w-1/3">
          <Button
            variant="ghost"
            className="h-full w-full opacity-0"
            aria-label={settings.direction === 'rightToLeft' ? 'Next page' : 'Previous page'}
            onClick={settings.direction === 'rightToLeft' ? forward : back}
          >
            <span />
          </Button>
        </div>

        <div className="absolute inset-y-0 right-0 flex w-1/3">
          <Button
            variant="ghost"
            className="h-full w-full opacity-0"
            aria-label={settings.direction === 'rightToLeft' ? 'Previous page' : 'Next page'}
            onClick={settings.direction === 'rightToLeft' ? back : forward}
          >
            <span />
          </Button>
        </div>
      </div>

      <footer
        className={[
          'absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 p-3',
          'bg-gradient-to-t from-shade/80 to-transparent',
          'transition-opacity duration-[var(--duration-fast)]',
          isChromeShown ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      >
        <Slider
          label="Page"
          tone="overlay"
          value={at}
          max={Math.max(groups.length - 1, 0)}
          onValueChange={(value) => {
            setAt(value);
            wake();
          }}
          className="flex-1"
        />

        <span className="w-24 shrink-0 text-right text-xs tabular-nums text-on-scrim/80">
          {showing.length === 0
            ? '—'
            : `${((showing[0] ?? 0) + 1).toString()} / ${pageCount.toString()}`}
        </span>
      </footer>

      <div className="hidden">
        {preloading.map((address) => (
          <img key={address} src={address} alt="" />
        ))}
      </div>
    </div>
  );
};

PageReader.displayName = 'PageReader';

export { PageReader, widthFor };
