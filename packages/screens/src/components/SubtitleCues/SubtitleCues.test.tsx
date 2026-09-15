import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SubtitleCues } from './SubtitleCues';
import { DEFAULT_CAPTION_STYLE } from '@ValenceScreens/playback/captionStyle';
import type { SubtitleCue, SubtitleSpan } from '@ValenceClient/playback/fetchSubtitleCues';

const A_FILE = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello there

00:00:05.000 --> 00:00:08.000
Later on
`;

const spanOf = (over: Partial<SubtitleSpan> = {}): SubtitleSpan => ({
  text: '',
  fontFamily: null,
  fontHeight: null,
  colour: null,
  opacity: null,
  isBold: false,
  isItalic: false,
  isUnderlined: false,
  isStruckThrough: false,
  ...over,
});

const signOf = (
  span: Partial<SubtitleSpan>,
  over: Partial<SubtitleCue> = {},
  spans?: Partial<SubtitleSpan>[],
): SubtitleCue => ({
  from: 0,
  to: 10,
  spans: (spans ?? [span]).map(spanOf),
  alignment: 7,
  position: null,
  margins: { left: 0, right: 0, vertical: 0 },
  isSign: true,
  ...over,
});

const dialogueOf = (text: string): SubtitleCue => ({
  from: 0,
  to: 10,
  spans: [spanOf({ text })],
  alignment: 2,
  position: null,
  margins: { left: 0, right: 0, vertical: 0 },
  isSign: false,
});

const servedCues = (cues: SubtitleCue[]) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ cues }) }),
  );
};

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

  it('draws a sign where the script put it, rather than down with the dialogue', async () => {
    servedCues([
      signOf({ text: 'CLOSED' }, { position: { x: 0.75, y: 0.2 }, alignment: 7 }),
      dialogueOf('I will be back by six.'),
    ]);

    render(
      <SubtitleCues src="/a.vtt" cuesSrc="/a/cues" atSeconds={2} style={DEFAULT_CAPTION_STYLE} />,
    );

    const sign = await screen.findByText('CLOSED');

    expect(sign.closest('div')).toHaveStyle({ left: '75%', top: '20%' });
  });

  it('shows a sign and the talking over it at once', async () => {
    servedCues([signOf({ text: 'CLOSED' }), dialogueOf('I will be back by six.')]);

    render(
      <SubtitleCues src="/a.vtt" cuesSrc="/a/cues" atSeconds={2} style={DEFAULT_CAPTION_STYLE} />,
    );

    expect(await screen.findByText('CLOSED')).toBeInTheDocument();
    expect(screen.getByText('I will be back by six.')).toBeInTheDocument();
  });

  it('dresses a sign the way the script asked', async () => {
    servedCues([signOf({ text: 'CLOSED', colour: '#ff0000', isBold: true })]);

    render(
      <SubtitleCues src="/a.vtt" cuesSrc="/a/cues" atSeconds={2} style={DEFAULT_CAPTION_STYLE} />,
    );

    expect(await screen.findByText('CLOSED')).toHaveStyle({
      color: '#ff0000',
      fontWeight: '700',
    });
  });

  it('splits a line where the script changed it partway', async () => {
    servedCues([
      signOf({ text: 'plain ' }, {}, [{ text: 'plain ' }, { text: 'italic', isItalic: true }]),
    ]);

    render(
      <SubtitleCues src="/a.vtt" cuesSrc="/a/cues" atSeconds={2} style={DEFAULT_CAPTION_STYLE} />,
    );

    expect(await screen.findByText('italic')).toHaveStyle({ fontStyle: 'italic' });
    expect(screen.getByText('plain')).toHaveStyle({ fontStyle: 'normal' });
  });

  it('reads the file as WebVTT where the track carries no styling of its own', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url: string) =>
          url.endsWith('/cues')
            ? Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
            : Promise.resolve({ ok: true, text: () => Promise.resolve(A_FILE) }),
        ),
    );

    render(
      <SubtitleCues src="/a.vtt" cuesSrc="/a/cues" atSeconds={2} style={DEFAULT_CAPTION_STYLE} />,
    );

    expect(await screen.findByText('Hello there')).toBeInTheDocument();
  });

  it('leaves dialogue in the viewer’s own lettering, whatever a script would prefer', async () => {
    servedCues([dialogueOf('I will be back by six.')]);

    render(
      <SubtitleCues
        src="/a.vtt"
        cuesSrc="/a/cues"
        atSeconds={2}
        style={{ ...DEFAULT_CAPTION_STYLE, color: '#ffff00' }}
      />,
    );

    const line = await screen.findByText('I will be back by six.');

    expect(line).toHaveStyle({ color: 'rgba(255, 255, 0, 1)' });
  });
});
