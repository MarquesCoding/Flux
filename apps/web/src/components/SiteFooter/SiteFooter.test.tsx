import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SiteFooter } from './SiteFooter';

const GENRES = ['Action', 'Comedy', 'Horror'];

describe('SiteFooter', () => {
  it('names every section a viewer can browse', () => {
    render(<SiteFooter genres={[]} onSectionChange={vi.fn()} onGenre={vi.fn()} />);

    const sections = screen.getByRole('navigation', { name: 'Browse' });

    for (const label of ['Home', 'Shows', 'Films', 'New & Popular', 'Favourites']) {
      expect(within(sections).getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('goes to a section when one is pressed', async () => {
    const onSectionChange = vi.fn<(section: string) => void>();
    const user = userEvent.setup();

    render(<SiteFooter genres={[]} onSectionChange={onSectionChange} onGenre={vi.fn()} />);

    await user.click(
      within(screen.getByRole('navigation', { name: 'Browse' })).getByRole('button', {
        name: 'Films',
      }),
    );

    expect(onSectionChange).toHaveBeenCalledWith('films');
  });

  it('lists the genres the library actually holds', () => {
    render(<SiteFooter genres={GENRES} onSectionChange={vi.fn()} onGenre={vi.fn()} />);

    const genres = screen.getByRole('navigation', { name: 'Genres' });

    expect(within(genres).getAllByRole('button')).toHaveLength(GENRES.length);
  });

  it('opens a genre when one is pressed', async () => {
    const onGenre = vi.fn<(genre: string) => void>();
    const user = userEvent.setup();

    render(<SiteFooter genres={GENRES} onSectionChange={vi.fn()} onGenre={onGenre} />);

    await user.click(screen.getByRole('button', { name: 'Horror' }));

    expect(onGenre).toHaveBeenCalledWith('Horror');
  });

  it('leaves the genres out entirely rather than showing an empty heading', () => {
    render(<SiteFooter genres={[]} onSectionChange={vi.fn()} onGenre={vi.fn()} />);

    expect(screen.queryByRole('navigation', { name: 'Genres' })).not.toBeInTheDocument();
  });

  it('holds itself to a readable number of genres', () => {
    const many = Array.from({ length: 40 }, (_, index) => `Genre ${index.toString()}`);

    render(<SiteFooter genres={many} onSectionChange={vi.fn()} onGenre={vi.fn()} />);

    const genres = screen.getByRole('navigation', { name: 'Genres' });

    expect(within(genres).getAllByRole('button').length).toBeLessThan(many.length);
  });

  it('says who is answerable for the library', () => {
    render(<SiteFooter genres={[]} onSectionChange={vi.fn()} onGenre={vi.fn()} />);

    expect(screen.getByText(/responsibility of whoever runs this server/)).toBeInTheDocument();
  });

  it('carries a copyright line for the year it is being read in', () => {
    render(<SiteFooter genres={[]} onSectionChange={vi.fn()} onGenre={vi.fn()} />);

    expect(screen.getByText(`© ${new Date().getFullYear().toString()} Flux`)).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(SiteFooter.displayName).toBe('SiteFooter');
  });
});
