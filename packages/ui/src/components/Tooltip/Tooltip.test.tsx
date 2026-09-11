import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('says nothing until a pointer rests on the control', () => {
    render(
      <Tooltip label="Pop out">
        <button type="button">Pop out</button>
      </Tooltip>,
    );

    expect(screen.queryByText('Pop out', { selector: 'div' })).not.toBeInTheDocument();
  });

  it('names the control once a pointer has rested on it', async () => {
    const user = userEvent.setup();

    render(
      <Tooltip label="Pop out">
        <button type="button" aria-label="Pop out" />
      </Tooltip>,
    );

    await user.hover(screen.getByRole('button', { name: 'Pop out' }));

    expect(await screen.findByText('Pop out')).toBeInTheDocument();
  });

  it('leaves the control exactly as its caller built it', () => {
    render(
      <Tooltip label="Pop out">
        <button type="button" className="the-caller-said-so">
          Pop out
        </button>
      </Tooltip>,
    );

    expect(screen.getByRole('button')).toHaveClass('the-caller-said-so');
  });

  it('draws the control and nothing else where it has been told to say nothing', () => {
    render(
      <Tooltip label="Pop out" isDisabled>
        <button type="button">Pop out</button>
      </Tooltip>,
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('is a small solid chip in the page colours turned over, rather than a pane of glass', async () => {
    const user = userEvent.setup();

    render(
      <Tooltip label="Pop out">
        <button type="button" aria-label="Pop out" />
      </Tooltip>,
    );

    await user.hover(screen.getByRole('button', { name: 'Pop out' }));

    const chip = (await screen.findAllByText('Pop out'))
      .map((found) => found.closest('[data-slot="tooltip-content"]'))
      .find((found) => found !== null);

    expect(chip).toHaveClass('bg-text', 'text-surface', 'rounded-sm');
    expect(chip?.className).not.toContain('valence-glass');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(Tooltip.displayName).toBe('Tooltip');
  });
});
