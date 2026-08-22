import { describe, expect, it } from 'vitest';
import { cleanBookDocument } from './cleanBookDocument';

const asIs = (href: string): string => `/api/books/1/resource/${href}`;

describe('cleanBookDocument', () => {
  it('keeps the writing, which is the point of a book', () => {
    expect(cleanBookDocument('<p>Call me <em>Ishmael</em>.</p>', asIs)).toBe(
      '<p>Call me <em>Ishmael</em>.</p>',
    );
  });

  it('removes a script, which a book from a stranger may carry', () => {
    const clean = cleanBookDocument('<p>Hello</p><script>alert(1)</script>', asIs);

    expect(clean).not.toContain('script');
    expect(clean).not.toContain('alert');
  });

  it('removes a handler hiding on a tag that is otherwise allowed', () => {
    const clean = cleanBookDocument('<p onclick="steal()">Hello</p>', asIs);

    expect(clean).not.toContain('onclick');
    expect(clean).toContain('Hello');
  });

  it('removes an address that runs rather than points', () => {
    const clean = cleanBookDocument('<a href="javascript:alert(1)">tap</a>', asIs);

    expect(clean).not.toContain('javascript');
  });

  it('removes a frame, which could carry anything at all', () => {
    expect(cleanBookDocument('<iframe src="https://elsewhere"></iframe>', asIs)).not.toContain(
      'iframe',
    );
  });

  it("drops the book's own styling, since Valence decides how a book is set", () => {
    const clean = cleanBookDocument('<style>p { color: red }</style><p>Hello</p>', asIs);

    expect(clean).not.toContain('color');
    expect(clean).toContain('Hello');
  });

  it('points a picture back at Valence, since a book keeps its pictures inside itself', () => {
    expect(cleanBookDocument('<img src="images/one.png" alt="a" />', asIs)).toContain(
      '/api/books/1/resource/images/one.png',
    );
  });

  it('removes a picture the book does not actually hold', () => {
    const clean = cleanBookDocument('<img src="elsewhere.png" />', () => null);

    expect(clean).not.toContain('img');
  });
});
