import { describe, expect, it } from 'vitest';
import { pathSegments } from './pathSegments';

describe('pathSegments', () => {
  it('steps down from the top of the disk to the folder given', () => {
    expect(pathSegments('/media/films')).toEqual([
      { label: '/', path: '/' },
      { label: 'media', path: '/media' },
      { label: 'films', path: '/media/films' },
    ]);
  });

  it('is only the root at the top of the disk', () => {
    expect(pathSegments('/')).toEqual([{ label: '/', path: '/' }]);
  });

  it('ignores a slash left on the end', () => {
    expect(pathSegments('/media/').map((segment) => segment.path)).toEqual(['/', '/media']);
  });

  it('reads a Windows path by its drive and its backslashes', () => {
    expect(pathSegments('D:\\Media\\Films')).toEqual([
      { label: 'D:\\', path: 'D:\\' },
      { label: 'Media', path: 'D:\\Media' },
      { label: 'Films', path: 'D:\\Media\\Films' },
    ]);
  });
});
