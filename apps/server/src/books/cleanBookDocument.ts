import sanitizeHtml from 'sanitize-html';

const ALLOWED = [
  'p',
  'div',
  'span',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'em',
  'i',
  'strong',
  'b',
  'u',
  's',
  'small',
  'sub',
  'sup',
  'mark',
  'blockquote',
  'q',
  'cite',
  'pre',
  'code',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'img',
  'figure',
  'figcaption',
  'a',
  'ruby',
  'rt',
  'rp',
  'section',
  'article',
  'aside',
  'header',
  'footer',
  'nav',
  'abbr',
  'time',
];

/**
 * Makes a chapter of somebody else's book safe to put in a page of ours.
 *
 * A book is a file from a stranger, and its chapters are arbitrary XHTML that ends up on the same
 * origin as somebody's library. Scripts, event handlers, embedded frames and anything that can fetch
 * are removed rather than trusted, by a sanitiser that is maintained for the purpose — hand-written
 * sanitising is how this goes wrong.
 *
 * **The book's own stylesheets are dropped**, not sanitised. Flux decides how a book is set — size,
 * leading, margins, and whether the page is light, sepia or dark — and a stylesheet that fought that
 * would win in places and lose in others. It also removes a whole class of things to get wrong:
 * there is no CSS to escape from if there is no CSS.
 *
 * Pictures are kept, and their addresses are rewritten to point back at Flux, because a book's
 * pictures live inside the book and no browser can reach in there.
 *
 * @param html - The chapter as the book wrote it.
 * @param addressFor - Turns a path inside the book into one this server serves.
 * @returns The chapter, safe to render.
 */
const cleanBookDocument = (html: string, addressFor: (href: string) => string | null): string =>
  sanitizeHtml(html, {
    allowedTags: ALLOWED,
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      '*': ['id', 'lang', 'dir'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href'],
    transformTags: {
      img: (_name, attribs) => {
        const src = attribs['src'];
        const address = src === undefined ? null : addressFor(src);

        return address === null
          ? { tagName: 'span', attribs: {} }
          : { tagName: 'img', attribs: { ...attribs, src: address } };
      },
    },
    nonTextTags: ['script', 'style', 'textarea', 'noscript', 'title'],
  });

export { cleanBookDocument };
