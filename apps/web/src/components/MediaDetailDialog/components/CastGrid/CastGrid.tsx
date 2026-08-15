import { PageDots } from '@FluxUI/PageDots';
import { usePagedScroller } from '@FluxUI/usePagedScroller';
import type { CastGridProps } from './CastGrid.types';

/**
 * Shows the cast of a film or programme as a horizontal rail of faces, each with the performer's
 * name and the part they played. The rail pages rather than scrolls freely, and carries a row of
 * dots and a count once there is more than one page of it. A performer the catalogue has no
 * photograph for is drawn as an empty frame rather than being left out.
 *
 * @param members - The cast in billing order, each with a name, a role and an image if one is known.
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

export { CastGrid };
