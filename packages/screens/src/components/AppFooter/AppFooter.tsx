import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Button } from '@ValenceUI/Button';
import { Logo } from '@ValenceUI/Logo';
import { libraryQueries } from '@ValenceClient/query/libraryQueries';
import { sessionQueries } from '@ValenceClient/query/sessionQueries';
import type { AppFooterProps } from './AppFooter.types';

const GENRES_SHOWN = 6;

const LINK = 'w-fit justify-start text-sm font-normal text-text/85 hover:text-text';

/**
 * One column of the footer: what it is about, and the places it leads to.
 *
 * @param title - What the column is about.
 * @param children - Its links.
 */
const Column = ({ title, children }: { title: string; children: ReactNode }) => (
  <nav aria-label={title} className="valence-card-face flex flex-col gap-4 p-6">
    <h2 className="text-xs uppercase tracking-[0.16em] text-text-muted">{title}</h2>

    <ul className="flex flex-col gap-3">{children}</ul>
  </nav>
);

Column.displayName = 'Column';

/**
 * The foot of every page: what this is, the places it holds, a handful of its genres and the
 * account, and the version it runs — the things somebody reaches the bottom of a page looking for,
 * rather than a second copy of the bar.
 *
 * Drawn in the same two layers as the panels in the admin and account dialogs, and closed by the
 * name set large beneath it and fading out, so the page ends on something rather than stopping.
 *
 * @param places - The places in the bar, which the footer offers again in the same order; a place the
 *   bar leaves out for being empty is left out here too.
 * @param onPlace - Told which place was chosen.
 * @param onGenre - Told which genre to look through.
 * @param onAccount - Told which part of the account to open.
 * @param onAdmin - Told to open the server's settings, where the viewer runs it.
 * @param onSignOut - Told to end the session.
 */
const AppFooter = ({ places, onPlace, onGenre, onAccount, onAdmin, onSignOut }: AppFooterProps) => {
  const facets = useQuery(libraryQueries.facets());
  const build = useQuery(sessionQueries.version());

  const genres = (facets.data?.genres ?? []).slice(0, GENRES_SHOWN);
  const version = build.data ?? null;

  return (
    <footer className="relative overflow-hidden px-4 pt-8 sm:px-6">
      <div className="valence-card-shell p-2">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <section className="valence-card-face flex flex-col gap-4 p-6">
            <span className="flex items-center gap-3">
              <Logo size={32} isSolid />

              <span className="flex flex-col">
                <span className="text-lg font-semibold text-text">Valence</span>
                <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
                  Your library, your server
                </span>
              </span>
            </span>

            <p className="max-w-[48ch] font-body text-sm leading-relaxed text-text-muted">
              Everything you own, streamed from a machine you run — films, programmes and books in
              one place, for everybody in the house.
            </p>
          </section>

          <Column title="Browse">
            {places.map((place) => (
              <li key={place.id}>
                <Button
                  variant="link"
                  size="none"
                  className={LINK}
                  onClick={() => {
                    onPlace(place.id);
                  }}
                >
                  {place.label}
                </Button>
              </li>
            ))}
          </Column>

          {genres.length === 0 ? null : (
            <Column title="Genres">
              {genres.map((genre) => (
                <li key={genre}>
                  <Button
                    variant="link"
                    size="none"
                    className={LINK}
                    onClick={() => {
                      onGenre(genre);
                    }}
                  >
                    {genre}
                  </Button>
                </li>
              ))}
            </Column>
          )}

          <Column title="Account">
            <li>
              <Button
                variant="link"
                size="none"
                className={LINK}
                onClick={() => {
                  onAccount('profile');
                }}
              >
                Your account
              </Button>
            </li>

            <li>
              <Button
                variant="link"
                size="none"
                className={LINK}
                onClick={() => {
                  onAccount('security');
                }}
              >
                Password and sign-in
              </Button>
            </li>

            <li>
              <Button
                variant="link"
                size="none"
                className={LINK}
                onClick={() => {
                  onAccount('devices');
                }}
              >
                Devices
              </Button>
            </li>

            {onAdmin === undefined ? null : (
              <li>
                <Button variant="link" size="none" className={LINK} onClick={onAdmin}>
                  Server settings
                </Button>
              </li>
            )}

            <li>
              <Button variant="link" size="none" className={LINK} onClick={onSignOut}>
                Sign out
              </Button>
            </li>
          </Column>
        </div>

        <div className="valence-card-face mt-2 flex flex-wrap items-center justify-between gap-3 px-6 py-4 font-body text-sm text-text-muted">
          <p>
            © {new Date().getFullYear().toString()} Valence
            {version === null ? null : <span className="tabular-nums"> · {version}</span>}
          </p>

          <a
            href="/api/reference"
            className="underline-offset-4 transition-colors hover:text-text hover:underline"
          >
            API reference
          </a>
        </div>
      </div>

      <p
        aria-hidden
        className="pointer-events-none mt-4 select-none bg-gradient-to-b from-text/15 to-transparent bg-clip-text text-center text-[clamp(5rem,21vw,21rem)] font-semibold leading-[0.8] tracking-[-0.045em] text-transparent"
      >
        Valence
      </p>
    </footer>
  );
};

AppFooter.displayName = 'AppFooter';

export { AppFooter };
