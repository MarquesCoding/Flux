import { describe, expect, it } from 'vitest';
import { validateSetupForm, parseOrigins } from './validateSetupForm';

const valid = {
  name: 'Operator',
  email: 'admin@flux.test',
  password: 'a-long-enough-password',
  trustedOrigins: 'http://192.168.1.40:8420',
};

describe('validateSetupForm', () => {
  it('accepts a complete form', () => {
    expect(validateSetupForm(valid)).toEqual({});
  });

  it('rejects a blank name', () => {
    expect(validateSetupForm({ ...valid, name: '   ' }).name).toBeDefined();
  });

  it('rejects an address with no domain', () => {
    expect(validateSetupForm({ ...valid, email: 'admin@flux' }).email).toBeDefined();
  });

  it('rejects a short password', () => {
    expect(validateSetupForm({ ...valid, password: 'short' }).password).toBeDefined();
  });

  it('rejects an empty origin list', () => {
    expect(validateSetupForm({ ...valid, trustedOrigins: '  ' }).trustedOrigins).toBeDefined();
  });

  it('rejects a bare hostname that is not a url', () => {
    expect(
      validateSetupForm({ ...valid, trustedOrigins: '192.168.1.40:8420' }).trustedOrigins,
    ).toBeDefined();
  });

  it('accepts several comma separated origins', () => {
    expect(
      validateSetupForm({
        ...valid,
        trustedOrigins: 'http://192.168.1.40:8420, https://flux.example',
      }),
    ).toEqual({});
  });
});

describe('parseOrigins', () => {
  it('trims and drops empty entries', () => {
    expect(parseOrigins(' http://a.test , , http://b.test ')).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });

  it('returns nothing for a blank string', () => {
    expect(parseOrigins('   ')).toEqual([]);
  });
});
