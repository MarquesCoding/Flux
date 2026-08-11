import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResetLibrariesDialog } from './ResetLibrariesDialog';

describe('ResetLibrariesDialog', () => {
  it('warns that the rebuild cannot be undone', () => {
    render(
      <ResetLibrariesDialog isOpen isResetting={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
  });

  it('asks before doing anything', async () => {
    const onConfirm = vi.fn();
    const actor = userEvent.setup();

    render(
      <ResetLibrariesDialog isOpen isResetting={false} onClose={vi.fn()} onConfirm={onConfirm} />,
    );

    expect(onConfirm).not.toHaveBeenCalled();

    await actor.click(screen.getByRole('button', { name: 'Reset and rebuild' }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it('lets the operator back out', async () => {
    const onClose = vi.fn();
    const actor = userEvent.setup();

    render(
      <ResetLibrariesDialog isOpen isResetting={false} onClose={onClose} onConfirm={vi.fn()} />,
    );

    await actor.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('will not let a second click start a second rebuild', () => {
    render(<ResetLibrariesDialog isOpen isResetting onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
