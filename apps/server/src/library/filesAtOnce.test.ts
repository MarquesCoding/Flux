import { describe, expect, it } from 'vitest';
import { filesAtOnce } from '@ValenceServer/library/filesAtOnce';

describe('filesAtOnce', () => {
  it('holds a scan to what the device proved, not to what the processors suggest', () => {
    expect(filesAtOnce(10, 4)).toBe(4);
  });

  it('leaves a modest request alone where the device can take more', () => {
    expect(filesAtOnce(2, 8)).toBe(2);
  });

  it('lets the asked-for count stand where there is no hardware to be bounded by', () => {
    expect(filesAtOnce(10, 0)).toBe(10);
  });

  it('treats an answer it could not get as no answer rather than as none allowed', () => {
    expect(filesAtOnce(6, -1)).toBe(6);
  });
});
