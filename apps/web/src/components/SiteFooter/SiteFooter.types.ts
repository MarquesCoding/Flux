import type { ShellSection } from '@FluxWeb/components/AppShell/AppShell.types';

type SiteFooterProps = {
  /**
   * Every genre the library has something filed under.
   *
   * Passed in rather than read here, because the shell already knows when the
   * library has been reached and a footer that fetches on its own would ask
   * again on every section change.
   */
  genres: string[];
  onSectionChange: (section: ShellSection) => void;
  /**
   * Opens the search page narrowed to one genre.
   */
  onGenre: (genre: string) => void;
};

export type { SiteFooterProps };
