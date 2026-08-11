import { useEffect, useRef, useState } from 'react';
import { PageDots } from '@FluxUI/PageDots';
import type { CastGridProps } from './CastGrid.types';

/**
 * How wide a face wants to be, and how much air goes between two of them.
 *
 * Wide enough to recognise somebody and to fit a name under them without
 * breaking it across three lines.
 */
const FACE_WIDTH = 170;
const GAP = 16;

/**
 * The fewest to put on a line.
 *
 * A phone is narrower than three faces at that width, and three squeezed faces
 * beat one enormous one.
 */
const LEAST_PER_PAGE = 3;

/**
 * Who is in it.
 *
 * One line at a time rather than a block that wraps. A cast that wraps ends in
 * a row with a single face in it and six empty columns beside it, which reads
 * as something having gone wrong; a cast that pages is the same list with a
 * straight edge and a way to see the rest.
 *
 * How many fit is measured rather than assumed, because it is a question about
 * the width of this panel on this screen — and the panel is a dialog whose
 * width is itself a fraction of the window. A fixed count would leave a gap on
 * a wide screen and overflow a narrow one.
 */
const CastGrid = ({ members }: CastGridProps) => {
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(LEAST_PER_PAGE);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;

    if (track === null) {
      return;
    }

    const measure = () => {
      const fits = Math.floor((track.clientWidth + GAP) / (FACE_WIDTH + GAP));

      setPerPage(Math.max(LEAST_PER_PAGE, fits));
    };

    measure();

    const watcher = new ResizeObserver(measure);

    watcher.observe(track);

    return () => {
      watcher.disconnect();
    };
  }, []);

  const pages = Math.max(1, Math.ceil(members.length / perPage));
  const at = Math.min(page, pages - 1);
  const shown = members.slice(at * perPage, at * perPage + perPage);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
          Cast
          {members.length <= perPage ? null : (
            <span className="ml-2 tabular-nums text-text-muted/70">{members.length}</span>
          )}
        </h3>

        {/* The same markers the hero and the wall of faces use: how much
            there is, where you are in it, and a press to anywhere else. */}
        <PageDots count={pages} selectedIndex={at} label="Cast pages" onSelect={setPage} />
      </header>

      <div ref={trackRef}>
        <ul className="flex gap-4">
          {shown.map((member) => (
            <li
              key={`${member.name}-${member.role}`}
              className="flex min-w-0 flex-1 flex-col gap-3"
            >
              {/* Upright rather than round, and as wide as its share of the
                  line. A face the size of a thumbnail is a face nobody
                  recognises, which is the only thing a cast list is for. */}
              <span className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface-raised ring-1 ring-white/10">
                {member.imageUrl === null ? null : (
                  <img
                    src={member.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </span>

              <span className="flex flex-col items-center gap-0.5 text-center">
                <span className="text-sm font-medium leading-tight text-text">{member.name}</span>
                <span className="font-body text-xs leading-tight text-text-muted">
                  {member.role}
                </span>
              </span>
            </li>
          ))}

          {/* A last page with two people on it should not draw them at the
              width of six. The empty places are held rather than closed up, so
              a face is the same size on every page. */}
          {Array.from({ length: Math.max(0, perPage - shown.length) }, (_, index) => index).map(
            (index) => (
              <li key={`empty-${index.toString()}`} aria-hidden className="min-w-0 flex-1" />
            ),
          )}
        </ul>
      </div>
    </div>
  );
};

CastGrid.displayName = 'CastGrid';

export { CastGrid, FACE_WIDTH, LEAST_PER_PAGE };
