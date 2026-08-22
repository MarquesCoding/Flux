import { beforeEach, describe, expect, it } from 'vitest';
import { KEPT_UNDER, carryOldKeysOver } from './carryOldKeysOver';
import type { DeviceStore } from '@ValenceClient/platform/Platform.types';

let held: Map<string, string>;

const aStore = (): DeviceStore => ({
  read: (key) => held.get(key) ?? null,
  write: (key, value) => {
    held.set(key, value);
  },
  forget: (key) => {
    held.delete(key);
  },
});

beforeEach(() => {
  held = new Map();
});

describe('carryOldKeysOver', () => {
  it('carries a value to the name it is kept under now', () => {
    held.set('flux.gridSize', 'large');

    carryOldKeysOver(aStore());

    expect(held.get('valence.gridSize')).toBe('large');
  });

  it('forgets the old name, so this only ever runs once', () => {
    held.set('flux.gridSize', 'large');

    carryOldKeysOver(aStore());

    expect(held.has('flux.gridSize')).toBe(false);
  });

  it('says nothing and does nothing on a device that has nothing to carry', () => {
    expect(carryOldKeysOver(aStore())).toEqual([]);
    expect(held.size).toBe(0);
  });

  it('leaves a newer choice alone rather than overwriting it with an older one', () => {
    held.set('flux.gridSize', 'large');
    held.set('valence.gridSize', 'small');

    carryOldKeysOver(aStore());

    expect(held.get('valence.gridSize')).toBe('small');
  });

  it('still forgets the old name where the new one was already answered', () => {
    held.set('flux.gridSize', 'large');
    held.set('valence.gridSize', 'small');

    carryOldKeysOver(aStore());

    expect(held.has('flux.gridSize')).toBe(false);
  });

  it('carries every key this device could be holding', () => {
    for (const name of KEPT_UNDER) {
      held.set(`flux.${name}`, name);
    }

    const carried = carryOldKeysOver(aStore());

    expect(carried).toHaveLength(KEPT_UNDER.length);

    for (const name of KEPT_UNDER) {
      expect(held.get(`valence.${name}`)).toBe(name);
    }
  });

  it('carries the address of the server, which is the one nobody could guess again', () => {
    held.set('flux.server.address', 'http://localhost:8420');

    carryOldKeysOver(aStore());

    expect(held.get('valence.server.address')).toBe('http://localhost:8420');
  });
});
