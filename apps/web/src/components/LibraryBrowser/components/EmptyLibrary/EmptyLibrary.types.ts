type EmptyLibraryProps = {
  /**
   * What was searched for, or empty where nothing was.
   */
  search: string;
  /**
   * The library being looked at, or null where none has been chosen yet.
   */
  libraryName: string | null;
  /**
   * Whether any library on this server holds anything.
   *
   * The difference between "this one is empty" and "nothing has been scanned
   * anywhere", which want different things said and different things done.
   */
  hasContentElsewhere: boolean;
};

export type { EmptyLibraryProps };
