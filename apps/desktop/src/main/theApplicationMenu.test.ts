import { beforeEach, describe, expect, it, vi } from 'vitest';

type Item = {
  label?: string;
  role?: string;
  accelerator?: string;
  click?: () => void;
  submenu?: Item[];
};

const buildFromTemplate = vi.fn<(template: Item[]) => object>((template) => ({ template }));

const setApplicationMenu = vi.fn();

vi.mock('electron', () => ({
  Menu: { buildFromTemplate, setApplicationMenu },
  shell: { openExternal: vi.fn() },
}));

const { theApplicationMenu } = await import('./theApplicationMenu');

const everyItem = (items: Item[]): Item[] =>
  items.flatMap((item) => [item, ...everyItem(item.submenu ?? [])]);

const built = (): Item[] => everyItem(buildFromTemplate.mock.calls[0]?.[0] ?? []);

beforeEach(() => {
  buildFromTemplate.mockClear();
  setApplicationMenu.mockClear();
});

describe('theApplicationMenu', () => {
  it('offers a way back to choosing a server, which no screen can offer once the server draws them', () => {
    theApplicationMenu(vi.fn());

    expect(built().some((item) => item.label === 'Change server…')).toBe(true);
  });

  it('asks for a different one when that is chosen', () => {
    const changeServer = vi.fn();

    theApplicationMenu(changeServer);
    built().find((item) => item.label === 'Change server…')?.click?.();

    expect(changeServer).toHaveBeenCalledOnce();
  });

  it('keeps copy and paste, which setting a menu at all would otherwise take away', () => {
    theApplicationMenu(vi.fn());

    expect(built().some((item) => item.role === 'editMenu')).toBe(true);
  });

  it('keeps a way to reload, for a server that was restarted underneath the window', () => {
    theApplicationMenu(vi.fn());

    expect(built().some((item) => item.role === 'reload')).toBe(true);
  });

  it('offers it under File, since the application menu is named by the bundle and may not say Flux', () => {
    theApplicationMenu(vi.fn());

    const file = buildFromTemplate.mock.calls[0]?.[0].find((item) => item.label === 'File');

    expect(file?.submenu?.some((item) => item.label === 'Change server…')).toBe(true);
  });

  it('gives it a shortcut, for somebody who has already hunted for it once', () => {
    theApplicationMenu(vi.fn());

    const changing = built().filter((item) => item.label === 'Change server…');

    expect(changing.every((item) => item.accelerator === 'CmdOrCtrl+Shift+S')).toBe(true);
    expect(changing.length).toBeGreaterThan(0);
  });

  it('sets it, rather than building one nobody sees', () => {
    theApplicationMenu(vi.fn());

    expect(setApplicationMenu).toHaveBeenCalledOnce();
  });
});
