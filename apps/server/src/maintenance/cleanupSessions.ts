type CleanupSessionsOptions = {
  deleteExpiredSessions: () => Promise<number>;
  deleteExpiredDeviceCodes: () => Promise<number>;
  onProgress?: (phase: 'sessions' | 'deviceCodes', processed: number, total: number) => void;
};

/**
 * Deletes sign-in sessions and device authorisation codes that have expired. Neither is read once
 * expired, so this is purely about the tables not growing for ever.
 *
 * @param db - The database to sweep.
 * @returns How many of each were removed.
 */
const cleanupSessions = async ({
  deleteExpiredSessions,
  deleteExpiredDeviceCodes,
  onProgress,
}: CleanupSessionsOptions): Promise<number> => {
  onProgress?.('sessions', 0, 1);
  const sessionsRemoved = await deleteExpiredSessions();
  onProgress?.('sessions', 1, 1);

  onProgress?.('deviceCodes', 0, 1);
  const deviceCodesRemoved = await deleteExpiredDeviceCodes();
  onProgress?.('deviceCodes', 1, 1);

  return sessionsRemoved + deviceCodesRemoved;
};

export { cleanupSessions };
