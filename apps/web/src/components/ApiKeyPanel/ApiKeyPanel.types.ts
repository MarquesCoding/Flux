type ApiKeyPanelProps = {
  /**
   * How long a freshly made key stays on screen before the page stops
   * offering it.
   *
   * Only for tests, which cannot wait out the real one.
   */
  showKeyForMilliseconds?: number;
};

export type { ApiKeyPanelProps };
