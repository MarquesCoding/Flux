import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PanelCard } from './PanelCard';

describe('PanelCard', () => {
  it('names the block it holds, so it reads as one piece rather than a loose panel', () => {
    render(
      <PanelCard title="Libraries">
        <p>Films</p>
      </PanelCard>,
    );

    const card = screen.getByRole('heading', { name: 'Libraries' }).closest('section');

    expect(card).not.toBeNull();
    expect(within(card ?? document.body).getByText('Films')).toBeInTheDocument();
  });

  it('sets its controls in the shell beside the name, not on the panel', () => {
    render(
      <PanelCard title="Webhooks" actions={<span>Add a webhook</span>}>
        <p>Nothing is being told about anything.</p>
      </PanelCard>,
    );

    const heading = screen.getByRole('heading', { name: 'Webhooks' });
    const strip = heading.closest('header');

    expect(strip).not.toBeNull();
    expect(within(strip ?? document.body).getByText('Add a webhook')).toBeInTheDocument();
    expect(
      within(strip ?? document.body).queryByText('Nothing is being told about anything.'),
    ).not.toBeInTheDocument();
  });

  it('holds its content in a panel set into the shell', () => {
    const { container } = render(
      <PanelCard title="Roles">
        <p>Administrator</p>
      </PanelCard>,
    );

    const shell = container.querySelector('section');
    const face = screen.getByText('Administrator').parentElement;

    expect(shell).toHaveClass('valence-card-shell');
    expect(face).toHaveClass('valence-card-face');
    expect(face).toHaveClass('p-4');
  });

  it('lets a table run to the panel edges when asked to', () => {
    render(
      <PanelCard title="Logs" isFlush>
        <p>A line</p>
      </PanelCard>,
    );

    expect(screen.getByText('A line').parentElement).not.toHaveClass('p-4');
  });

  it('takes the caller layout classes on its shell', () => {
    const { container } = render(
      <PanelCard title="Recent jobs" className="lg:col-span-4">
        <p>Making a preview</p>
      </PanelCard>,
    );

    expect(container.querySelector('section')).toHaveClass('lg:col-span-4');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(PanelCard.displayName).toBe('PanelCard');
  });
});
