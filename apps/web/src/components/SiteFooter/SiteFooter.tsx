import { Button } from '@FluxUI/Button';
import { BROWSE_SECTIONS } from '@FluxWeb/components/AppShell/AppShell.types';
import type { ShellSection } from '@FluxWeb/components/AppShell/AppShell.types';
import type { SiteFooterProps } from './SiteFooter.types';

/**
 * How many genres are worth listing.
 *
 * A footer is a place to notice something, not an index. A library with sixty
 * genres would push everything else off the bottom of the page, and the
 * search page is where the whole list already lives.
 */
const GENRES_SHOWN = 12;

const SECTION_LABELS: Record<ShellSection, string> = {
  home: 'Home',
  shows: 'Shows',
  films: 'Films',
  new: 'New & Popular',
  favourites: 'Favourites',
  search: 'Search',
  account: 'Account',
  admin: 'Admin',
};

/**
 * The end of the page.
 *
 * Somewhere to land rather than somewhere to be sent: a viewer who has
 * scrolled to the bottom of a browse page has run out of what they were
 * reading, and the genres are the cheapest way to turn that into somewhere
 * else to look. They are read from what the library actually holds, so every
 * one of them leads to something.
 *
 * Plain lettering on the page rather than a panel. A footer that is a card is
 * a card that follows every page down, and the dock is already the one piece
 * of floating furniture this application has.
 *
 * The legal line says what is true of self-hosted software: the library and
 * the terms of using it belong to whoever runs the server, not to Flux. There
 * is deliberately nothing here pretending to be a terms of service — an
 * operator who needs one has to write it.
 */
const SiteFooter = ({ genres, onSectionChange, onGenre }: SiteFooterProps) => {
  const shown = genres.slice(0, GENRES_SHOWN);

  return (
    <footer className="mt-16 border-t border-[var(--surface-line)] px-5 pb-32 pt-10 sm:px-10">
      <div className="flex flex-col gap-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <p className="text-lg font-semibold tracking-tight text-text">Flux</p>

            <p className="max-w-xs font-body text-sm leading-relaxed text-text-muted">
              A streaming server somebody runs themselves, holding whatever they have put in it.
            </p>
          </div>

          <nav className="flex flex-col gap-3" aria-label="Browse">
            <h2 className="text-xs uppercase tracking-[0.16em] text-text-muted">Browse</h2>

            <ul className="flex flex-col items-start gap-1">
              {BROWSE_SECTIONS.map((section) => (
                <li key={section}>
                  <Button
                    variant="bare"
                    size="none"
                    className="text-sm text-text-muted transition-colors hover:text-text"
                    onClick={() => {
                      onSectionChange(section);
                    }}
                  >
                    {SECTION_LABELS[section]}
                  </Button>
                </li>
              ))}
            </ul>
          </nav>

          {shown.length === 0 ? null : (
            <nav className="flex flex-col gap-3 lg:col-span-2" aria-label="Genres">
              <h2 className="text-xs uppercase tracking-[0.16em] text-text-muted">Genres</h2>

              <ul className="flex flex-wrap gap-x-6 gap-y-1">
                {shown.map((genre) => (
                  <li key={genre}>
                    <Button
                      variant="bare"
                      size="none"
                      className="text-sm text-text-muted transition-colors hover:text-text"
                      onClick={() => {
                        onGenre(genre);
                      }}
                    >
                      {genre}
                    </Button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--surface-line)] pt-6 font-body text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>{`© ${new Date().getFullYear().toString()} Flux`}</p>

          <p className="max-w-xl sm:text-right">
            What is in this library, and the terms of watching it, are the responsibility of whoever
            runs this server.
          </p>
        </div>
      </div>
    </footer>
  );
};

SiteFooter.displayName = 'SiteFooter';

export { SiteFooter };
