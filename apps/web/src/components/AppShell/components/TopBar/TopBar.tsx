import { IconSearch, IconX } from '@tabler/icons-react'
import IconButtonModule from '@FluxUI/IconButton'
import type { TopBarProps } from './TopBar.types'

const { IconButton } = IconButtonModule

/**
 * The bar across the top of the application.
 *
 * Transparent over a hero and glass once anything has scrolled beneath it, so
 * the artwork owns the screen until there is something the bar needs to be
 * legible against.
 */
const TopBar = ({ search, onSearchChange, account, isLifted = false }: TopBarProps) => (
  <header
    className={`sticky top-0 z-20 flex items-center gap-3 px-6 py-3 transition-colors duration-300 ${
      isLifted ? 'flux-glass rounded-none border-x-0 border-t-0' : 'border-b border-transparent'
    }`}
  >
    <label className="group relative flex min-w-0 flex-1 items-center">
      <IconSearch
        size={18}
        className="pointer-events-none absolute left-4 text-text-muted"
        aria-hidden
      />

      <span className="sr-only">Search the library</span>

      <input
        type="search"
        value={search}
        placeholder="Search"
        onChange={(event) => {
          onSearchChange(event.target.value)
        }}
        className="h-11 w-full max-w-md rounded-full border border-white/10 bg-white/[0.06] pl-11 pr-10 text-sm text-text placeholder:text-text-muted backdrop-blur-xl focus:outline-2 focus:outline-offset-2 focus:outline-accent"
      />

      {search === '' ? null : (
        <span className="absolute right-1">
          <IconButton
            label="Clear the search"
            size="sm"
            onClick={() => {
              onSearchChange('')
            }}
          >
            <IconX size={16} aria-hidden />
          </IconButton>
        </span>
      )}
    </label>

    <div className="flex shrink-0 items-center gap-2">{account}</div>
  </header>
)

TopBar.displayName = 'TopBar'

export default { TopBar }
