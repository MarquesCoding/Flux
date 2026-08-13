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
 * A panel inset from the edges rather than a rule across the page. Everything
 * else on the platform sits on glass with room around it, and a full-bleed
 * block with a hairline over it was the one surface pretending to be a
 * website. It scrolls away with the page, which is what separates it from the
 * dock: the dock follows a viewer because it is how they leave, and this waits
 * at the bottom because it is what they find when they stop.
 *
 * Both lists are pills, because that is what a way somewhere looks like here —
 * the search page offers the same genres in the same shape. As bare words they
 * were a paragraph of nouns with nothing saying which of them could be
 * pressed, and twelve of them wrapping across a full-width column read as
 * spillage rather than as a list.
 *
 * The legal line says what is true of self-hosted software: the library and
 * the terms of using it belong to whoever runs the server, not to Flux. There
 * is deliberately nothing here pretending to be a terms of service — an
 * operator who needs one has to write it.
 */
const SiteFooter = ({ genres, onSectionChange, onGenre }: SiteFooterProps) => {
  const shown = genres.slice(0, GENRES_SHOWN);

  return (
    <footer className="px-5 pb-32 pt-16 sm:px-10">
      <div className="flux-glass flex flex-col gap-8 rounded-[2rem] p-7 sm:p-10">
        <div className="flex flex-col gap-9 lg:flex-row lg:gap-14">
          <div className="flex flex-col gap-2 lg:w-64 lg:shrink-0">
            <p className="text-lg font-semibold tracking-tight text-text">Flux</p>

            <p className="max-w-xs font-body text-sm leading-relaxed text-text-muted">
              A streaming server somebody runs themselves, holding whatever they have put in it.
            </p>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-7">
            <nav className="flex flex-col gap-3" aria-label="Browse">
              <h2 className="text-xs uppercase tracking-[0.16em] text-text-muted">Browse</h2>

              <ul className="flex flex-wrap gap-2">
                {BROWSE_SECTIONS.map((section) => (
                  <li key={section}>
                    <Button
                      size="sm"
                      isPill
                      variant="ghost"
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
              <nav className="flex flex-col gap-3" aria-label="Genres">
                <h2 className="text-xs uppercase tracking-[0.16em] text-text-muted">Genres</h2>

                <ul className="flex flex-wrap gap-2">
                  {shown.map((genre) => (
                    <li key={genre}>
                      <Button
                        size="sm"
                        isPill
                        variant="ghost"
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
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--surface-line)] pt-6 font-body text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <p className="shrink-0">{`© ${new Date().getFullYear().toString()} Flux`}</p>

          <p className="max-w-md leading-relaxed sm:text-right">
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
