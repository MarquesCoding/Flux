import { describe, expect, it, vi } from 'vitest';
import { migrateToLatest } from './migrateToLatest';

const said = () => {
  const lines: { level: string; line: string }[] = [];

  return {
    lines,
    say: (level: 'info' | 'error', line: string) => {
      lines.push({ level, line });
    },
  };
};

describe('migrateToLatest', () => {
  it('runs nothing against a database that is already in step', async () => {
    const apply = vi.fn(() => Promise.resolve());
    const reporter = said();

    const plan = await migrateToLatest({
      pending: () => Promise.resolve([]),
      apply,
      isAllowed: true,
      say: reporter.say,
    });

    expect(plan.kind).toBe('inStep');
    expect(apply).not.toHaveBeenCalled();
  });

  it('says nothing at all about a database in step, which is the ordinary start', async () => {
    const reporter = said();

    await migrateToLatest({
      pending: () => Promise.resolve([]),
      apply: () => Promise.resolve(),
      isAllowed: true,
      say: reporter.say,
    });

    expect(reporter.lines).toStrictEqual([]);
  });

  it('applies what is pending', async () => {
    const apply = vi.fn(() => Promise.resolve());

    await migrateToLatest({
      pending: () => Promise.resolve(['0049_jwks']),
      apply,
      isAllowed: true,
      say: said().say,
    });

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('names them before running them, so a migration that hangs says which', async () => {
    const reporter = said();
    const order: string[] = [];

    await migrateToLatest({
      pending: () => Promise.resolve(['0049_jwks']),
      apply: () => {
        order.push('applied');

        return Promise.resolve();
      },
      isAllowed: true,
      say: (level, line) => {
        order.push('said');
        reporter.say(level, line);
      },
    });

    expect(order).toStrictEqual(['said', 'applied', 'said']);
    expect(reporter.lines[0]?.line).toContain('0049_jwks');
  });

  it('leaves them alone and says so loudly when an operator opted out', async () => {
    const apply = vi.fn(() => Promise.resolve());
    const reporter = said();

    const plan = await migrateToLatest({
      pending: () => Promise.resolve(['0049_jwks']),
      apply,
      isAllowed: false,
      say: reporter.say,
    });

    expect(plan.kind).toBe('refuse');
    expect(apply).not.toHaveBeenCalled();
    expect(reporter.lines[0]?.level).toBe('error');
  });

  it('refuses to come up quietly when the migration itself fails', async () => {
    await expect(
      migrateToLatest({
        pending: () => Promise.resolve(['0049_jwks']),
        apply: () => Promise.reject(new Error('relation "jwks" is locked')),
        isAllowed: true,
        say: said().say,
      }),
    ).rejects.toThrow('relation "jwks" is locked');
  });

  it('does not claim the database is up to date when applying threw', async () => {
    const reporter = said();

    await migrateToLatest({
      pending: () => Promise.resolve(['0049_jwks']),
      apply: () => Promise.reject(new Error('nope')),
      isAllowed: true,
      say: reporter.say,
    }).catch(() => undefined);

    expect(reporter.lines.some((one) => one.line.includes('up to date'))).toBe(false);
  });
});
