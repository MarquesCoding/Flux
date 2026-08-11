import { useState } from 'react'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import IconButtonModule from '@FluxUI/IconButton'
import type { CastGridProps } from './CastGrid.types'

const { IconButton } = IconButtonModule

/**
 * How many faces are shown at once.
 *
 * A round number that divides evenly into the grid at every width it is drawn
 * at — four across on a phone, six on a desktop — so a page is never one face
 * on a line of its own.
 */
const PAGE_SIZE = 12

/**
 * Who is in it.
 *
 * A grid rather than a row that scrolls sideways. A cast is a set to look
 * through rather than a queue to walk along, and a sideways row of a hundred
 * people hides ninety of them behind a gesture nobody makes on a page they
 * have already scrolled to.
 *
 * Turned a page at a time rather than shown whole: a long cast would push the
 * rest of the page — the rest of the series, the way back — off the bottom of
 * the screen. The count says how much there is, so a page of twelve out of
 * ninety reads as the top of a list rather than as the whole of one.
 */
const CastGrid = ({ members }: CastGridProps) => {
  const [page, setPage] = useState(0)

  const pages = Math.max(1, Math.ceil(members.length / PAGE_SIZE))
  const at = Math.min(page, pages - 1)
  const shown = members.slice(at * PAGE_SIZE, at * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
          Cast
          {members.length <= PAGE_SIZE ? null : (
            <span className="ml-2 tabular-nums text-text-muted/70">{members.length}</span>
          )}
        </h3>

        {/* Only where there is somewhere to go. Two arrows that never do
            anything are two things to try. */}
        {pages === 1 ? null : (
          <span className="flex items-center gap-1">
            <IconButton
              label="Earlier in the cast"
              size="sm"
              disabled={at === 0}
              onClick={() => {
                setPage(at - 1)
              }}
            >
              <IconChevronLeft size={18} aria-hidden />
            </IconButton>

            <span className="px-1 text-xs tabular-nums text-text-muted">
              {at + 1} / {pages}
            </span>

            <IconButton
              label="Further into the cast"
              size="sm"
              disabled={at === pages - 1}
              onClick={() => {
                setPage(at + 1)
              }}
            >
              <IconChevronRight size={18} aria-hidden />
            </IconButton>
          </span>
        )}
      </header>

      <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map((member) => (
          <li key={`${member.name}-${member.role}`} className="flex flex-col items-center gap-3">
            {/* Square rather than round, and as wide as its column. A face the
                size of a thumbnail is a face nobody recognises, which is the
                only thing a cast list is for. */}
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
              <span className="text-xs leading-tight text-text-muted">{member.role}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

CastGrid.displayName = 'CastGrid'

export default { CastGrid, PAGE_SIZE }
