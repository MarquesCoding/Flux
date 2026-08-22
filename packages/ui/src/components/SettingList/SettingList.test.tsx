import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingList } from './SettingList';
import { SettingRow } from '@ValenceUI/SettingRow';

const theList = (): HTMLElement => {
  const list = screen.getByText('Language').closest('[data-slot="setting-list"]');

  if (!(list instanceof HTMLElement)) {
    throw new Error('No list around the rows');
  }

  return list;
};

describe('SettingList', () => {
  it('keeps the rows it was given, in the order it was given them', () => {
    render(
      <SettingList>
        <SettingRow title="Language" />
        <SettingRow title="Temperature unit" />
      </SettingList>,
    );

    expect(theList().textContent).toBe('LanguageTemperature unit');
  });

  it('draws the line between rows rather than under each one', () => {
    render(
      <SettingList>
        <SettingRow title="Language" />
      </SettingList>,
    );

    expect(theList()).toHaveClass('divide-y');
  });

  it('takes the line off a row it has outlined, so the two do not collide', () => {
    render(
      <SettingList>
        <SettingRow title="Language" />
        <SettingRow title="Temperature unit" isMarked />
      </SettingList>,
    );

    expect(theList().className).toContain('[&>[data-marked]]:border-transparent');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(SettingList.displayName).toBe('SettingList');
  });
});
