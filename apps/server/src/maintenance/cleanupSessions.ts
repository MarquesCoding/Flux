type CleanupSessionsOptions = {
  deleteExpiredSessions: () => Promise<number>;
  deleteExpiredDeviceCodes: () => Promise<number>;
  onProgress?: (phase: 'sessions' | 'deviceCodes', processed: number, total: number) => void;
};

/**
 * Clears out expired sign-in sessions and device-authorization codes.
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
