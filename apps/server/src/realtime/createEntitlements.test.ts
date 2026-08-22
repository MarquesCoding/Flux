import { describe, expect, it } from 'vitest';
import { createEntitlements } from './createEntitlements';
import type { Permission } from '@ValenceContracts/schemas/Permission';

const createReader = (permissions: Permission[]) => {
  let calls = 0;
  let given = permissions;

  return {
    calls: () => calls,
    give: (next: Permission[]) => {
      given = next;
    },
    resolve: (): Promise<ReadonlySet<Permission>> => {
      calls += 1;

      return Promise.resolve(new Set(given));
    },
  };
};

describe('createEntitlements', () => {
  it('reads permissions for an account it has not seen', async () => {
    const reader = createReader(['server.logs']);
    const entitlements = createEntitlements({ resolve: reader.resolve, now: () => 0, ttlMs: 5000 });

    expect(await entitlements.of('account')).toStrictEqual(new Set(['server.logs']));
  });

  it('does not read again within the window, so a flood costs one query', async () => {
    const reader = createReader(['server.logs']);
    const entitlements = createEntitlements({ resolve: reader.resolve, now: () => 0, ttlMs: 5000 });

    for (let index = 0; index < 4000; index += 1) {
      await entitlements.of('account');
    }

    expect(reader.calls()).toBe(1);
  });

  it('reads again once the window has passed', async () => {
    const reader = createReader(['server.logs']);
    let clock = 0;
    const entitlements = createEntitlements({
      resolve: reader.resolve,
      now: () => clock,
      ttlMs: 5000,
    });

    await entitlements.of('account');
    clock = 5000;
    await entitlements.of('account');

    expect(reader.calls()).toBe(2);
  });

  it('keeps accounts apart rather than answering one with another', async () => {
    const reader = createReader(['server.logs']);
    const entitlements = createEntitlements({ resolve: reader.resolve, now: () => 0, ttlMs: 5000 });

    await entitlements.of('one');
    await entitlements.of('two');

    expect(reader.calls()).toBe(2);
  });

  it('picks up a revoked permission immediately when told to forget', async () => {
    const reader = createReader(['server.logs']);
    const entitlements = createEntitlements({ resolve: reader.resolve, now: () => 0, ttlMs: 5000 });

    await entitlements.of('account');
    reader.give([]);
    entitlements.forget('account');

    expect(await entitlements.of('account')).toStrictEqual(new Set());
  });

  it('forgets every account when a role everyone holds changes', async () => {
    const reader = createReader(['server.logs']);
    const entitlements = createEntitlements({ resolve: reader.resolve, now: () => 0, ttlMs: 5000 });

    await entitlements.of('one');
    await entitlements.of('two');
    reader.give([]);
    entitlements.forgetAll();

    expect(await entitlements.of('one')).toStrictEqual(new Set());
    expect(await entitlements.of('two')).toStrictEqual(new Set());
  });
});
