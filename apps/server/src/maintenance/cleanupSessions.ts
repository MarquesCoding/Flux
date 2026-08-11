type CleanupSessionsOptions = {
  /**
   * Deletes every session past its expiry, answering how many.
   *
   * better-auth checks expiry at read time and never deletes an expired row
   * itself, so nothing else does either — this is the one thing that ever
   * reclaims the table.
   */
  deleteExpiredSessions: () => Promise<number>
  /**
   * Deletes every device-authorization code past its expiry, answering how
   * many.
   *
   * A code a television never finished entering, or one nobody polled again
   * after — the `deviceCode` table has no cascade and nothing else prunes
   * it either.
   */
  deleteExpiredDeviceCodes: () => Promise<number>
  onProgress?: (phase: 'sessions' | 'deviceCodes', processed: number, total: number) => void
}

/**
 * Clears out expired sign-in sessions and device-authorization codes.
 *
 * Both are rows a normal request path only ever adds to — signing in adds a
 * session, a television requesting a code adds one of those — and nothing
 * in the ordinary lifecycle of either ever removes one once it has expired.
 */
const cleanupSessions = async ({
  deleteExpiredSessions,
  deleteExpiredDeviceCodes,
  onProgress,
}: CleanupSessionsOptions): Promise<number> => {
  onProgress?.('sessions', 0, 1)
  const sessionsRemoved = await deleteExpiredSessions()
  onProgress?.('sessions', 1, 1)

  onProgress?.('deviceCodes', 0, 1)
  const deviceCodesRemoved = await deleteExpiredDeviceCodes()
  onProgress?.('deviceCodes', 1, 1)

  return sessionsRemoved + deviceCodesRemoved
}

export default { cleanupSessions }
