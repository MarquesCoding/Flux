import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingRow } from './SettingRow';

const rowOf = (title: string): HTMLElement => {
  const row = screen.getByText(title).closest('[data-slot="setting-row"]');

  if (!(row instanceof HTMLElement)) {
    throw new Error(`No row around ${title}`);
  }

  return row;
};

describe('SettingRow', () => {
  it('names the setting', () => {
    render(<SettingRow title="Launch at Login" />);

    expect(screen.getByText('Launch at Login')).toBeInTheDocument();
  });

  it('says what changing it does', () => {
    render(<SettingRow title="Launch at Login" description="Open Valence when you sign in" />);

    expect(screen.getByText('Open Valence when you sign in')).toBeInTheDocument();
  });

  it('says nothing where there is nothing to say', () => {
    render(<SettingRow title="Launch at Login" />);

    expect(rowOf('Launch at Login').textContent).toBe('Launch at Login');
  });

  it('holds the control that answers it', () => {
    render(
      <SettingRow title="Language">
        <button type="button">English</button>
      </SettingRow>,
    );

    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
  });

  it('is not itself something to press, so a row has one press target rather than two', () => {
    render(<SettingRow title="Launch at Login" description="Open Valence when you sign in" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('leaves an unmarked row unoutlined', () => {
    render(<SettingRow title="Full Disk Access" />);

    expect(rowOf('Full Disk Access')).not.toHaveAttribute('data-marked');
  });

  it('outlines the row being pointed at, and says so as well as drawing it', () => {
    render(<SettingRow title="Clean Screen Input Protection" isMarked />);

    const row = rowOf('Clean Screen Input Protection');

    expect(row).toHaveAttribute('data-marked', 'true');
    expect(row).toHaveClass('ring-highlight');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(SettingRow.displayName).toBe('SettingRow');
  });
});
