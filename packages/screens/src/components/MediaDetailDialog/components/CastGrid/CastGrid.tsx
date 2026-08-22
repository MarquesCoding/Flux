import { Icon } from '@ValenceUI/Icon';
import { UserIcon } from '@phosphor-icons/react';
import { PageDots } from '@ValenceUI/PageDots';
import { Button } from '@ValenceUI/Button';
import { cn } from '@ValenceUI/cn';
import { canOpenPerson } from '@ValenceContracts/schemas/Person';
import { usePagedScroller } from '@ValenceUI/usePagedScroller';
import type { CastGridProps } from './CastGrid.types';

/**
 * Shows the cast of a film or programme as a horizontal rail of faces, each with the performer's
 * name and the part they played. The rail pages rather than scrolls freely, and carries a row of
 * dots and a count once there is more than one page of it. A performer the catalogue has no
 * photograph for keeps their place in the rail, drawn with the same figure the person dialog uses,
 * so a face nobody has a picture of still reads as somebody rather than as a hole in the row.
 *
 * The photograph grows a little under the pointer, and the frame around it does not. Growing the
 * whole card instead pushed the picture past the rounded corners it was being clipped by, and the
 * corners came back square for as long as the pointer was on it — the same arrangement `MediaCard`
 * settled on, for the same reason.
 *
 * A performer the catalogue gave an identifier can be opened to see what else of theirs is here.
 * One the catalogue never matched is drawn the same but cannot be pressed — there is nothing behind
 * a name on its own, and offering to open it would open an empty dialog.
 *
 * @param members - The cast in billing order, each with a name, a role and an image if one is known.
 * @param onOpenPerson - Told which performer to open, where opening one is offered at all.
 */
const CastGrid = ({ members, onOpenPerson }: CastGridProps) => {
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
          className="valence-rail flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth"
        >
          {members.map((member) => (
            <li
              key={`${member.name}-${member.role}`}
              className="flex w-[42vw] shrink-0 snap-start flex-col gap-3 sm:w-[10.625rem]"
            >
              <Button
                variant="bare"
                size="none"
                label={`About ${member.name}`}
                hasTooltip={false}
                disabled={!canOpenPerson(member.personId) || onOpenPerson === undefined}
                className={cn(
                  'group flex flex-col gap-3 rounded-lg text-left',
                  canOpenPerson(member.personId) && onOpenPerson !== undefined
                    ? ''
                    : 'disabled:cursor-default disabled:opacity-100',
                )}
                onClick={() => {
                  onOpenPerson?.(member);
                }}
              >
                <span className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface-raised ring-1 ring-white/10">
                  {member.imageUrl === null ? (
                    <span className="flex h-full w-full items-center justify-center">
                      <Icon of={UserIcon} size={48} className="text-text-muted" />
                    </span>
                  ) : (
                    <img
                      src={member.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] motion-reduce:transition-none hover-hover:group-hover:scale-105"
                    />
                  )}
                </span>

                <span className="flex w-full flex-col items-center gap-0.5 text-center">
                  <span className="text-sm font-medium leading-tight text-text">{member.name}</span>
                  <span className="font-body text-xs leading-tight text-text-muted">
                    {member.role}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

CastGrid.displayName = 'CastGrid';

export { CastGrid };
