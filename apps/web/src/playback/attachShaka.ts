import type shaka from 'shaka-player/dist/shaka-player.compiled'

/**
 * The slice of Shaka that Flux uses.
 *
 * Narrowed from the shipped types so tests can supply a stand-in without
 * reproducing a media engine, and so it is obvious what Flux depends on.
 */
type ShakaPlayer = {
  attach: (element: HTMLMediaElement) => Promise<void>
  load: (manifestUrl: string) => Promise<void>
  destroy: () => Promise<void>
}

type ShakaModule = {
  polyfill: { installAll: () => void }
  Player: new () => ShakaPlayer
}

type AttachOptions = {
  element: HTMLVideoElement
  manifestUrl: string
  loadShaka?: () => Promise<ShakaModule>
}

/**
 * Loads Shaka Player on demand.
 *
 * Imported dynamically so the engine is not in the initial bundle: most of a
 * session is spent browsing, and a viewer who never presses play should never
 * download a media engine.
 */
const loadShakaPlayer = async (): Promise<ShakaModule> => {
  const imported: typeof shaka = (await import('shaka-player/dist/shaka-player.compiled')).default

  return imported
}

/**
 * Attaches a player to a video element and loads a manifest.
 *
 * Returns a teardown function. Callers must call it: an orphaned player keeps
 * buffering and holds the media element open.
 */
const attachShaka = async ({
  element,
  manifestUrl,
  loadShaka = loadShakaPlayer,
}: AttachOptions): Promise<() => Promise<void>> => {
  const shaka = await loadShaka()

  shaka.polyfill.installAll()

  const player = new shaka.Player()

  await player.attach(element)
  await player.load(manifestUrl)

  return () => player.destroy()
}

export type { AttachOptions, ShakaModule, ShakaPlayer }

export { attachShaka, loadShakaPlayer }
