import type { MoodLight } from '@FluxUI/MoodBackground.types';
import type { ReactNode } from 'react';
import type { LibraryKind } from '@FluxContracts/schemas/Library';

/**
 * The places the bar can take a viewer.
 *
 * The first five are named across the middle of the bar; the rest are reached
 * from the tools at its right, because searching, notifications and the
 * account are things you do rather than places to browse.
 */
const SHELL_SECTIONS = [
  'home',
  'shows',
  'films',
  'new',
  'favourites',
  'search',
  'account',
  'admin',
] as const;

/**
 * The places named in the middle of the bar, in the order they are read.
 */
const BROWSE_SECTIONS = ['home', 'shows', 'films', 'new', 'favourites'] as const;

type ShellSection = (typeof SHELL_SECTIONS)[number];

type AppShellProps = {
  section: ShellSection;
  onSectionChange: (section: ShellSection) => void;
  children: ReactNode;
  /**
   * The colours the page is lit by, read from what is on screen.
   */
  moodLights?: MoodLight[];
  /**
   * Whether this viewer administers the server. The section is hidden from
   * everyone else rather than shown and refused.
   */
  isAdministrator?: boolean;
  /**
   * The face to draw on the account button, when this viewer has one.
   */
  avatar?: ReactNode;
  /**
   * Opens something chosen at random.
   *
   * Left out where there is nothing to choose from, and the control is not
   * drawn at all rather than drawn and refusing.
   *
   * Called with nothing to mean anything on the server, or with a kind for
   * somebody who has already decided they want a film.
   */
  onSurprise?: (only?: LibraryKind) => void;
  /**
   * The kinds of library this server holds.
   *
   * What the dice offer to narrow to, so a server with no music does not
   * offer to pick some. One kind offers no choice worth making, and the dice
   * stay a plain button.
   */
  surpriseKinds?: LibraryKind[];
  /**
   * The bell, drawn among the tools at the right of the bar.
   *
   * Passed as a node rather than as data because what hangs behind it is a
   * panel with its own state, and the shell's business is where it sits
   * rather than what it says. Left out where there is nobody signed in to
   * have notifications.
   */
  notifications?: ReactNode;
};

export type { AppShellProps, ShellSection };

export { SHELL_SECTIONS, BROWSE_SECTIONS };
