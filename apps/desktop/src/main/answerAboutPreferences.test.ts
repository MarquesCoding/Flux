import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

type Asking = { returnValue?: Record<string, string> };

type Said = (event: Asking, ...what: JsonValue[]) => void;

const listening = new Map<string, Said>();

vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, said: Said) => {
      listening.set(channel, said);
    },
  },
}));

const kept = new Map<string, string>();

vi.mock('@ValenceDesktop/main/thePreferenceFile', () => ({
  thePreferenceFile: () => ({
    all: () => Object.fromEntries(kept),
    read: (key: string) => kept.get(key) ?? null,
    write: (key: string, value: string) => {
      kept.set(key, value);
    },
    forget: (key: string) => {
      kept.delete(key);
    },
  }),
}));

const { answerAboutPreferences } = await import('./answerAboutPreferences');
const { FORGET_ONE, READ_EVERYTHING, WRITE_ONE } = await import('./preferenceChannels');

const asked = (channel: string, ...what: JsonValue[]): Record<string, string> | undefined => {
  const event: Asking = {};

  listening.get(channel)?.(event, ...what);

  return event.returnValue;
};

beforeEach(() => {
  kept.clear();
  listening.clear();
});

describe('answerAboutPreferences', () => {
  it('answers what the machine remembers at once, because a preference is read while drawing', () => {
    kept.set('valence.server.address', 'https://valence.example');
    answerAboutPreferences(vi.fn());

    expect(asked(READ_EVERYTHING)).toEqual({ 'valence.server.address': 'https://valence.example' });
  });

  it('keeps what the window writes', () => {
    answerAboutPreferences(vi.fn());
    asked(WRITE_ONE, 'valence.server.address', 'https://valence.example');

    expect(kept.get('valence.server.address')).toBe('https://valence.example');
  });

  it('says which key was written, for whatever out here follows that one', () => {
    const afterWrite = vi.fn();

    answerAboutPreferences(afterWrite);
    asked(WRITE_ONE, 'valence.server.address', 'https://valence.example');

    expect(afterWrite).toHaveBeenCalledWith('valence.server.address');
  });

  it('says which key was forgotten', () => {
    const afterWrite = vi.fn();

    kept.set('valence.server.address', 'https://valence.example');
    answerAboutPreferences(afterWrite);
    asked(FORGET_ONE, 'valence.server.address');

    expect([kept.has('valence.server.address'), afterWrite.mock.calls]).toEqual([
      false,
      [['valence.server.address']],
    ]);
  });

  it('evaluates nothing it is handed that is not a pair of strings', () => {
    const afterWrite = vi.fn();

    answerAboutPreferences(afterWrite);
    asked(WRITE_ONE, 'valence.server.address', 7);
    asked(FORGET_ONE, 7);

    expect([kept.size, afterWrite.mock.calls.length]).toEqual([0, 0]);
  });
});
