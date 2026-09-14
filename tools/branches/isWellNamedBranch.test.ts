import { describe, expect, it } from 'vitest';
import { TYPES, describeBadBranchName, isWellNamedBranch } from './isWellNamedBranch';

describe('isWellNamedBranch', () => {
  it('takes a branch named for the work on it', () => {
    expect(isWellNamedBranch('feat/hide-a-library-per-profile')).toBe(true);
    expect(isWellNamedBranch('fix/a-stop-that-ends-one-viewing')).toBe(true);
  });

  it('takes every type a commit may carry, so the two vocabularies are one', () => {
    for (const type of TYPES) {
      expect(isWellNamedBranch(`${type}/something`)).toBe(true);
    }
  });

  it('refuses a branch named after a person, which says nothing about the work', () => {
    expect(isWellNamedBranch('marques/the-thing')).toBe(false);
    expect(isWellNamedBranch('vgcgamingvg/val-159-security-audit')).toBe(false);
  });

  it('refuses a bare description with no type in front of it', () => {
    expect(isWellNamedBranch('one-render-job')).toBe(false);
    expect(isWellNamedBranch('artwork-size')).toBe(false);
  });

  it('refuses capitals and spaces, which read differently in a shell and a url', () => {
    expect(isWellNamedBranch('Fix/Something')).toBe(false);
    expect(isWellNamedBranch('fix/two words')).toBe(false);
  });

  it('refuses a type with nothing after it', () => {
    expect(isWellNamedBranch('fix/')).toBe(false);
    expect(isWellNamedBranch('fix')).toBe(false);
  });

  it('refuses a description that starts with punctuation', () => {
    expect(isWellNamedBranch('fix/-leading')).toBe(false);
    expect(isWellNamedBranch('fix/.hidden')).toBe(false);
  });

  it('takes the trunk, which nobody renames', () => {
    expect(isWellNamedBranch('main')).toBe(true);
  });

  it('leaves a bot to name its own branches', () => {
    expect(isWellNamedBranch('renovate/vitest-monorepo')).toBe(true);
    expect(isWellNamedBranch('dependabot/npm_and_yarn/vite-8.2.1')).toBe(true);
  });
});

describe('describeBadBranchName', () => {
  it('says what is wrong, what is wanted, and how to fix it', () => {
    const said = describeBadBranchName('my-branch');

    expect(said).toContain('my-branch');
    expect(said).toContain('type/short-description');
    expect(said).toContain('git branch -m my-branch');
  });
});
