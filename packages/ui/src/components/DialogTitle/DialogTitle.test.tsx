import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DialogTitle } from './DialogTitle';

describe('DialogTitle', () => {
  it('says what the dialog is about', () => {
    render(<DialogTitle title="Your account" />);

    expect(screen.getByRole('heading', { level: 2, name: 'Your account' })).toBeInTheDocument();
  });

  it('explains it where the title alone leaves something unsaid', () => {
    render(<DialogTitle title="Server" detail="Media service up" />);

    expect(screen.getByText('Media service up')).toBeInTheDocument();
  });

  it('draws what it is given before the title and beside it', () => {
    render(
      <DialogTitle title="Server" icon={<span data-testid="mark" />}>
        <span data-testid="close" />
      </DialogTitle>,
    );

    expect(screen.getByTestId('mark')).toBeInTheDocument();
    expect(screen.getByTestId('close')).toBeInTheDocument();
  });

  it('carries a row beneath, such as the tabs of the dialog', () => {
    render(<DialogTitle title="Server" below={<nav aria-label="What to look at" />} />);

    expect(screen.getByRole('navigation', { name: 'What to look at' })).toBeInTheDocument();
  });

  it('stands large by default, the title and its line one above the other', () => {
    render(<DialogTitle title="Share" detail="Anybody with the link" />);

    const title = screen.getByRole('heading', { name: 'Share' });

    expect(title).toHaveClass('text-2xl');
    expect(title.parentElement).toHaveClass('flex-col');
  });

  it('keeps to one line at body size where it heads a workspace', () => {
    render(<DialogTitle size="compact" title="Server" detail="Valence 1.0 · Media service up" />);

    const title = screen.getByRole('heading', { name: 'Server' });

    expect(title).toHaveClass('text-base');
    expect(title).not.toHaveClass('text-2xl');
    expect(title.parentElement).not.toHaveClass('flex-col');
    expect(screen.getByText('Valence 1.0 · Media service up')).toHaveClass('text-xs');
  });

  it('takes less room around itself when compact', () => {
    const { container: roomy } = render(<DialogTitle title="Share" />);
    const { container: compact } = render(<DialogTitle size="compact" title="Server" />);

    expect(roomy.querySelector('header')).toHaveClass('pt-6');
    expect(compact.querySelector('header')).toHaveClass('pt-3');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(DialogTitle.displayName).toBe('DialogTitle');
  });
});
