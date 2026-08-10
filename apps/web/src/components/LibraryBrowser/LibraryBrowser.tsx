import { useCallback, useEffect, useState } from 'react'
import { IconRefresh } from '@tabler/icons-react'
import ButtonModule from '@FluxUI/Button'
import MediaCardModule from '@FluxUI/MediaCard'
import SpinnerModule from '@FluxUI/Spinner'
import TextFieldModule from '@FluxUI/TextField'
import fetchLibraryModule from '@FluxWeb/library/fetchLibrary'
import describeMediaModule from './describeMedia'
import type { Library, MediaSummary } from '@FluxContracts/schemas/Library'
import type { BrowserState, LibraryBrowserProps } from './LibraryBrowser.types'

const { Button } = ButtonModule
const { MediaCard } = MediaCardModule
const { Spinner } = SpinnerModule
const { TextField } = TextFieldModule
const { fetchLibraries, fetchLibraryItems, scanLibrary } = fetchLibraryModule
const { describeMedia, describeBadges } = describeMediaModule

const PAGE_SIZE = 60
const SEARCH_DEBOUNCE_MS = 250

/**
 * Browses a library.
 *
 * Search is debounced and served by the database rather than filtered in the
 * browser: the client only ever holds one page, so filtering here would search
 * the page rather than the library and quietly lie about the results.
 */
const LibraryBrowser = ({ onPlay }: LibraryBrowserProps) => {
  const [libraries, setLibraries] = useState<Library[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [items, setItems] = useState<MediaSummary[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [state, setState] = useState<BrowserState>('loading')
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    let abandoned = false

    fetchLibraries()
      .then((found) => {
        if (abandoned) {
          return
        }

        setLibraries(found)
        setSelectedId(found[0]?.id ?? null)
        setState('ready')
      })
      .catch(() => {
        if (!abandoned) {
          setState('unreachable')
        }
      })

    return () => {
      abandoned = true
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [search])

  const loadItems = useCallback(async () => {
    if (selectedId === null) {
      return
    }

    try {
      const page = await fetchLibraryItems(selectedId, {
        search: appliedSearch,
        limit: PAGE_SIZE,
      })

      setItems(page.items)
      setTotal(page.total)
    } catch {
      setState('unreachable')
    }
  }, [selectedId, appliedSearch])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const rescan = async () => {
    if (selectedId === null) {
      return
    }

    setIsScanning(true)

    try {
      await scanLibrary(selectedId)
      await loadItems()
    } finally {
      setIsScanning(false)
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex justify-center p-12">
        <Spinner label="Loading your library" size="lg" />
      </div>
    )
  }

  if (state === 'unreachable') {
    return (
      <p role="alert" className="text-sm text-danger">
        Your library could not be loaded. Check that the server is running and reload.
      </p>
    )
  }

  if (libraries.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium text-text">No libraries yet</h2>
        <p className="text-text-muted">
          Add a library pointing at a folder of media, then scan it to see your films here.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {libraries.map((entry) => (
            <Button
              key={entry.id}
              size="sm"
              variant={entry.id === selectedId ? 'primary' : 'secondary'}
              onClick={() => {
                setSelectedId(entry.id)
              }}
            >
              {entry.name}
            </Button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          isLoading={isScanning}
          onClick={() => {
            void rescan()
          }}
        >
          <IconRefresh size={16} aria-hidden />
          Scan
        </Button>
      </header>

      <TextField
        label="Search"
        value={search}
        onValueChange={setSearch}
        placeholder="Search by title"
      />

      {items.length === 0 ? (
        <p className="text-text-muted">
          {appliedSearch === ''
            ? 'This library is empty. Scan it to find your media.'
            : `Nothing matches “${appliedSearch}”.`}
        </p>
      ) : (
        <>
          <p className="text-sm text-text-muted">
            {total === 1 ? '1 item' : `${String(total)} items`}
          </p>

          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((media) => (
              <li key={media.id}>
                <MediaCard
                  title={media.title}
                  subtitle={describeMedia(media)}
                  badges={describeBadges(media)}
                  onSelect={() => {
                    onPlay(media)
                  }}
                  className="w-full"
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

LibraryBrowser.displayName = 'LibraryBrowser'

export default { LibraryBrowser }
