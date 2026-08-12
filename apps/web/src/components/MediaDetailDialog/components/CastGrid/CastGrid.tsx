import { PageDots } from '@FluxUI/PageDots';
import { usePagedScroller } from '@FluxUI/usePagedScroller';
import type { CastGridProps } from './CastGrid.types';

/**
 * How wide a face wants to be.
 *
 * Wide enough to recognise somebody and to fit a name under them without
 * breaking it across three lines. Narrower than that on a phone, where two
 * squeezed faces beat one enormous one.
 */
const FACE_WIDTH = 170;

/**
 * Who is in it.
 *
 * One line at a time rather than a block that wraps. A cast that wraps ends in
 * a row with a single face in it and six empty columns beside it, which reads
 * as something having gone wrong; a cast that pages is the same list with a
 * straight edge and a way to see the rest.
 *
 * It scrolls rather than swapping which faces are drawn, so a page turn is the
 * row moving under a finger or a trackpad and the markers are only there for a
 * mouse. Swapping the slice made paging a jump cut, and made a trackpad useless
 * on a list that plainly ran off the edge of the panel.
 */
const CastGrid = ({ members }: CastGridProps) => {
  const { trackRef, pages, measure, scrollTo } = usePagedScroller<HTMLUListElement>([members]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
          Cast
          {pages.count < 2 ? null : (
            <span className="ml-2 tabular-nums text-text-muted/70">{members.length}</span>
          )}
        </h3>

        <PageDots
          count={pages.count}
          selectedIndex={pages.at}
          label="Cast pages"
          onSelect={scrollTo}
        />
      </header>

      <div>
        <ul
          ref={trackRef}
          onScroll={measure}
          className="flux-rail flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth"
        >
          {members.map((member) => (
            <li
              key={`${member.name}-${member.role}`}
              className="flex w-[42vw] shrink-0 snap-start flex-col gap-3 sm:w-[10.625rem]"
            >
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
        </ul>
      </div>
    </div>
  );
};

CastGrid.displayName = 'CastGrid';

export { CastGrid, FACE_WIDTH };
