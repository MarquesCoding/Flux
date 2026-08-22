import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SubtitleCues } from './SubtitleCues';
import { DEFAULT_CAPTION_STYLE } from '@ValenceScreens/playback/captionStyle';

const A_FILE = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello there

00:00:05.000 --> 00:00:08.000
Later on
`;

const served = (text: string) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(text) }),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SubtitleCues', () => {
  it('draws what is being said', async () => {
    served(A_FILE);

    render(<SubtitleCues src="/a.vtt" atSeconds={2} style={DEFAULT_CAPTION_STYLE} />);

    expect(await screen.findByText('Hello there')).toBeInTheDocument();
  });

  it('draws nothing where nobody is speaking', async () => {
    served(A_FILE);

    const { container } = render(
      <SubtitleCues src="/a.vtt" atSeconds={4.5} style={DEFAULT_CAPTION_STYLE} />,
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('follows the film as it plays', async () => {
    served(A_FILE);

    const drawn = render(<SubtitleCues src="/a.vtt" atSeconds={2} style={DEFAULT_CAPTION_STYLE} />);

    await screen.findByText('Hello there');

    drawn.rerender(<SubtitleCues src="/a.vtt" atSeconds={6} style={DEFAULT_CAPTION_STYLE} />);

    expect(screen.getByText('Later on')).toBeInTheDocument();
  });

  it('sits above the controls while they are up', async () => {
    served(A_FILE);

    render(<SubtitleCues src="/a.vtt" atSeconds={2} style={DEFAULT_CAPTION_STYLE} isLifted />);

    const line = await screen.findByText('Hello there');

    expect(line.parentElement).toHaveStyle({ bottom: '18%' });
  });

  it('sits lower once they go away', async () => {
    served(A_FILE);

    render(<SubtitleCues src="/a.vtt" atSeconds={2} style={DEFAULT_CAPTION_STYLE} />);

    const line = await screen.findByText('Hello there');

    expect(line.parentElement).toHaveStyle({ bottom: '8%' });
  });

  it('draws them the way this viewer likes captions drawn', async () => {
    served(A_FILE);

    render(
      <SubtitleCues
        src="/a.vtt"
        atSeconds={2}
        style={{ ...DEFAULT_CAPTION_STYLE, color: '#ff0000', opacity: 1 }}
      />,
    );

    expect(await screen.findByText('Hello there')).toHaveStyle({ color: 'rgba(255, 0, 0, 1)' });
  });

  it('says nothing at all where the file could not be read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('gone')));

    const { container } = render(
      <SubtitleCues src="/a.vtt" atSeconds={2} style={DEFAULT_CAPTION_STYLE} />,
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
