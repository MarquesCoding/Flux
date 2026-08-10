import type { Library, MediaSummary } from '@FluxContracts/schemas/Library'

type LibraryBrowserProps = {
  onPlay: (media: MediaSummary) => void
}

type BrowserState = 'loading' | 'ready' | 'unreachable'

type LoadedLibraries = {
  libraries: Library[]
  selectedId: string | null
}

export type { BrowserState, LibraryBrowserProps, LoadedLibraries }
