import fetchLibraryModule from '@FluxWeb/library/fetchLibrary'
import type { MediaSummary } from '@FluxContracts/schemas/Library'

const { fetchLibraries, fetchLibraryItems } = fetchLibraryModule

/**
 * Something to watch, chosen by nobody.
 *
 * For the evening that starts with twenty minutes of scrolling. The point of
 * it is that it is not a recommendation: no weighting by what was watched, no
 * favouring of what a page happened to load, just one item out of everything
 * on the server with the same chance as any other.
 *
 * Which is why it counts first and then asks. Picking from the items a page is
 * already showing would offer the top of the first rail forever, and reading
 * the whole library to shuffle it would fetch ten thousand descriptions to use
 * one. A count and a single item at a random place is two small requests and
 * an honestly flat distribution.
 *
 * Answers with nothing rather than throwing: a server with an empty library
 * has nothing to suggest, and that is an answer rather than a fault.
 */
const pickAnything = async (): Promise<MediaSummary | null> => {
  try {
    const libraries = await fetchLibraries()

    const counts = await Promise.all(
      libraries.map(async (entry) =>
        fetchLibraryItems(entry.id, { limit: 1 })
          .then((page) => ({ id: entry.id, total: page.total }))
          .catch(() => ({ id: entry.id, total: 0 })),
      ),
    )

    const total = counts.reduce((held, entry) => held + entry.total, 0)

    if (total === 0) {
      return null
    }

    // One number across every library rather than a library and then an item
    // within it: choosing the shelf first would give a shelf of three the same
    // chance as a shelf of three thousand.
    let at = Math.floor(Math.random() * total)

    for (const entry of counts) {
      if (at < entry.total) {
        const page = await fetchLibraryItems(entry.id, { limit: 1, offset: at })

        return page.items[0] ?? null
      }

      at -= entry.total
    }

    return null
  } catch {
    return null
  }
}

export default { pickAnything }
