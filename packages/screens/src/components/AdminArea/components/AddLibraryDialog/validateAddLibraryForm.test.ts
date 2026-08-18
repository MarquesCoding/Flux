import { describe, expect, it } from 'vitest';
import { validateAddLibraryForm } from './validateAddLibraryForm';

describe('validateAddLibraryForm', () => {
  it('accepts a name and a path', () => {
    expect(validateAddLibraryForm({ name: 'Films', path: '/media/films' })).toEqual({});
  });

  it('requires a name', () => {
    expect(validateAddLibraryForm({ name: '', path: '/media/films' }).name).toEqual(
      'Enter a name for this library.',
    );
  });

  it('rejects a name of only whitespace', () => {
    expect(validateAddLibraryForm({ name: '   ', path: '/media/films' }).name).toEqual(
      'Enter a name for this library.',
    );
  });

  it('requires a path', () => {
    expect(validateAddLibraryForm({ name: 'Films', path: '' }).path).toEqual(
      'Enter the path to this library on the machine running Flux.',
    );
  });
});
