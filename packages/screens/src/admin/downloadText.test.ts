import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadText } from './downloadText';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('downloadText', () => {
  it('hands over a file named as asked', () => {
    const clicked: string[] = [];

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:one');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
      this: HTMLAnchorElement,
    ) {
      clicked.push(this.download);
    });

    downloadText('valence-log.txt', 'a line');

    expect(clicked).toStrictEqual(['valence-log.txt']);
  });

  it('lets go of the file once it has been handed over', () => {
    const released = vi.fn();

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:one');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(released);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadText('valence-log.txt', 'a line');

    expect(released).toHaveBeenCalledWith('blob:one');
  });

  it('leaves nothing behind in the page', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:one');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadText('valence-log.txt', 'a line');

    expect(document.querySelectorAll('a')).toHaveLength(0);
  });
});
