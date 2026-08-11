const STORAGE_KEY = 'flux.clientId'

/**
 * Which open tab this is.
 *
 * Kept in session storage rather than local storage, so a new tab is a new
 * one — the same distinction Jellyfin's own sessions make, and the reason an
 * admin can see every tab a viewer has open rather than one entry per
 * device.
 */
const readClientId = (): string => {
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY)

    if (existing !== null) {
      return existing
    }

    const created = crypto.randomUUID()

    window.sessionStorage.setItem(STORAGE_KEY, created)

    return created
  } catch {
    // A browser refusing storage still needs an id for this call, it just
    // will not be remembered for the next one.
    return crypto.randomUUID()
  }
}

export default { readClientId }
