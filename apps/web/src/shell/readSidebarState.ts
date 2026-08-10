const STORAGE_KEY = 'flux.sidebarExpanded'

/**
 * Whether the sidebar was left open.
 *
 * Remembered in the browser rather than on the account: how much room the rail
 * can spare is a property of the screen in front of someone, not of who they
 * are. Defaults to open, because a rail of unexplained icons is no way to meet
 * an application for the first time.
 */
const readSidebarState = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

/**
 * Remembers whether the sidebar was left open.
 */
const saveSidebarState = (isExpanded: boolean): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, isExpanded ? 'true' : 'false')
  } catch {
    // A browser refusing storage is not a reason to stop drawing the shell.
  }
}

export default { readSidebarState, saveSidebarState, STORAGE_KEY }
