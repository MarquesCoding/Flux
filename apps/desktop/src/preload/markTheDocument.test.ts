import { describe, expect, it } from 'vitest';
import { markTheDocument } from './markTheDocument';

const HTML = 'http://www.w3.org/1999/xhtml';

const anUnparsedDocument = (): Document => document.implementation.createDocument(null, null, null);

describe('markTheDocument', () => {
  it('marks a document that has already been parsed', () => {
    const within = document.implementation.createHTMLDocument();

    markTheDocument(within);

    expect(within.querySelector('html')?.dataset['fluxDesktop']).toBe('true');
  });

  it('does not throw where the page has not been parsed yet, which is when a preload runs', () => {
    expect(() => {
      markTheDocument(anUnparsedDocument());
    }).not.toThrow();
  });

  it('marks the root once the parser puts one there', async () => {
    const within = anUnparsedDocument();

    markTheDocument(within);

    within.append(within.createElementNS(HTML, 'html'));

    await new Promise((settle) => {
      setTimeout(settle, 0);
    });

    expect(within.querySelector('html')?.dataset['fluxDesktop']).toBe('true');
  });

  it('stops watching once it has marked one, so nothing is left observing the document', async () => {
    const within = anUnparsedDocument();

    markTheDocument(within);

    within.append(within.createElementNS(HTML, 'html'));

    await new Promise((settle) => {
      setTimeout(settle, 0);
    });

    const root = within.querySelector('html');
    root?.remove();
    within.append(within.createElementNS(HTML, 'html'));

    await new Promise((settle) => {
      setTimeout(settle, 0);
    });

    expect(within.querySelector('html')?.dataset['fluxDesktop']).toBeUndefined();
  });
});
