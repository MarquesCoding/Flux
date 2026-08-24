import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WebhookFilterList } from './WebhookFilterList';
import type { WebhookFilterListProps } from './WebhookFilterList.types';

const draw = (overrides: Partial<WebhookFilterListProps> = {}) => {
  const props: WebhookFilterListProps = {
    title: 'Accounts',
    governs: 'Decides whose sign-ins are reported.',
    choices: [
      { id: 'account-1', label: 'Ada' },
      { id: 'account-2', label: 'Grace' },
    ],
    chosen: [],
    nothingToChoose: 'This server has no other accounts yet.',
    onChange: vi.fn(),
    ...overrides,
  };

  render(<WebhookFilterList {...props} />);

  return props;
};

describe('WebhookFilterList', () => {
  it('says which events this list decides, so it is not one wall of names', () => {
    draw();

    expect(screen.getByText('Decides whose sign-ins are reported.')).toBeInTheDocument();
  });

  it('starts on everybody, which is what an empty list means', () => {
    draw({ chosen: [] });

    expect(
      within(screen.getByRole('group', { name: 'Which accounts' })).getByRole('button', {
        name: 'Everybody',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('asks for no names at all while it is on everybody', () => {
    draw({ chosen: [] });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('starts on the names where a subscription has already been narrowed', () => {
    draw({ chosen: ['account-1'] });

    expect(
      within(screen.getByRole('group', { name: 'Which accounts' })).getByRole('button', {
        name: 'Only these',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox', { name: 'Ada' })).toBeChecked();
  });

  it('shows the names once there are some to pick', async () => {
    const user = userEvent.setup();

    draw({ chosen: [] });

    await user.click(
      within(screen.getByRole('group', { name: 'Which accounts' })).getByRole('button', {
        name: 'Only these',
      }),
    );

    expect(screen.getByRole('checkbox', { name: 'Ada' })).toBeInTheDocument();
  });

  it('goes back to everybody in one press, and forgets the names', async () => {
    const user = userEvent.setup();
    const { onChange } = draw({ chosen: ['account-1'] });

    await user.click(
      within(screen.getByRole('group', { name: 'Which accounts' })).getByRole('button', {
        name: 'Everybody',
      }),
    );

    expect(onChange).toHaveBeenCalledWith([]);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('presses the same side twice without anything odd happening', async () => {
    const user = userEvent.setup();

    draw({ chosen: [] });

    await user.click(
      within(screen.getByRole('group', { name: 'Which accounts' })).getByRole('button', {
        name: 'Everybody',
      }),
    );
    await user.click(
      within(screen.getByRole('group', { name: 'Which accounts' })).getByRole('button', {
        name: 'Everybody',
      }),
    );

    expect(
      within(screen.getByRole('group', { name: 'Which accounts' })).getByRole('button', {
        name: 'Everybody',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('adds somebody to the list', async () => {
    const user = userEvent.setup();
    const { onChange } = draw({ chosen: ['account-1'] });

    await user.click(screen.getByRole('checkbox', { name: 'Grace' }));

    expect(onChange).toHaveBeenCalledWith(['account-1', 'account-2']);
  });

  it('takes somebody back off it', async () => {
    const user = userEvent.setup();
    const { onChange } = draw({ chosen: ['account-1', 'account-2'] });

    await user.click(screen.getByRole('checkbox', { name: 'Ada' }));

    expect(onChange).toHaveBeenCalledWith(['account-2']);
  });

  it('says so where there is nothing to choose from at all', () => {
    draw({ choices: [] });

    expect(screen.getByText('This server has no other accounts yet.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
