import { describe, expect, it } from 'vitest';
import { HOW_TO_MIGRATE_BY_HAND, planMigration } from './planMigration';

describe('planMigration', () => {
  it('does nothing to a database that is already in step', () => {
    expect(planMigration({ pending: [], isAllowed: true })).toStrictEqual({ kind: 'inStep' });
  });

  it('does nothing to one in step even where migrating is not allowed', () => {
    expect(planMigration({ pending: [], isAllowed: false })).toStrictEqual({ kind: 'inStep' });
  });

  it('applies what is pending when it may', () => {
    const plan = planMigration({ pending: ['0049_jwks', '0050_shelves'], isAllowed: true });

    expect(plan.kind).toBe('apply');
    expect(plan.kind === 'apply' && plan.pending).toStrictEqual(['0049_jwks', '0050_shelves']);
  });

  it('names what it is about to run, so the log says it before it happens', () => {
    const plan = planMigration({ pending: ['0049_jwks'], isAllowed: true });

    expect(plan.kind === 'apply' && plan.saying).toContain('0049_jwks');
  });

  it('leaves them alone when told not to migrate', () => {
    const plan = planMigration({ pending: ['0049_jwks'], isAllowed: false });

    expect(plan.kind).toBe('refuse');
  });

  it('tells an operator who opted out a command that exists inside the container', () => {
    const plan = planMigration({ pending: ['0049_jwks'], isAllowed: false });

    expect(plan.kind === 'refuse' && plan.saying).toContain(HOW_TO_MIGRATE_BY_HAND);
  });

  it('never names drizzle-kit, which the published image does not carry', () => {
    const refused = planMigration({ pending: ['0049_jwks'], isAllowed: false });
    const applying = planMigration({ pending: ['0049_jwks'], isAllowed: true });

    expect(refused.kind === 'refuse' && refused.saying).not.toContain('drizzle-kit');
    expect(refused.kind === 'refuse' && refused.saying).not.toContain('db:migrate');
    expect(applying.kind === 'apply' && applying.saying).not.toContain('db:migrate');
  });

  it('says migration where there is one and migrations where there are several', () => {
    const one = planMigration({ pending: ['0049_jwks'], isAllowed: true });
    const two = planMigration({ pending: ['0049_jwks', '0050_shelves'], isAllowed: true });

    expect(one.kind === 'apply' && one.saying).toContain('1 migration ');
    expect(two.kind === 'apply' && two.saying).toContain('2 migrations ');
  });

  it('says how to turn migrating back on, since opting out is the state somebody forgets', () => {
    const plan = planMigration({ pending: ['0049_jwks'], isAllowed: false });

    expect(plan.kind === 'refuse' && plan.saying).toContain('MIGRATE_ON_START');
  });
});
