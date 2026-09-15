import { useEffect, useState } from 'react';
import { fetchSubtitleCues } from '@ValenceClient/playback/fetchSubtitleCues';
import { asSubtitleLines } from '@ValenceScreens/playback/asSubtitleLines';
import { linesAt } from '@ValenceScreens/playback/linesAt';
import { toCuePlacement } from '@ValenceScreens/playback/toCuePlacement';
import { toSpanStyle } from '@ValenceScreens/playback/toSpanStyle';
import { toCueDeclarations } from '@ValenceScreens/playback/captionStyle';
import type { SubtitleCue } from '@ValenceClient/playback/fetchSubtitleCues';
import type { SubtitleCuesProps } from './SubtitleCues.types';

const CLEAR_OF_THE_CONTROLS = '18%';

const NEAR_THE_BOTTOM = '8%';

/**
 * Subtitles drawn by the application rather than by the thing playing the film.
 *
 * A browser draws these itself, given a `track` element on the video it is playing. There is no
 * video element when the operating system is doing the playing — the picture is behind the window,
 * and nothing behind the window knows what this application's subtitles are or where its controls
 * sit. So the file is read here and the lines are drawn as part of the page, over the picture, with
 * the same preferences a browser would have been handed.
 *
 * It moves out of the way of the controls when they are up, which a browser only manages through a
 * positioning hint that has to be rewritten into the file. Here it is where the line is put.
 *
 * A track that is a script is asked for as lines that kept where they go and what they were dressed
 * in, and anything else — or any track on a server that cannot answer that — is read as WebVTT and
 * dressed in nothing, which is the same thing this drew before scripts were understood.
 *
 * Whose styling wins depends on what a line is. A sign is the author's: a shop front, a caption, a
 * note in the corner of the frame, drawn where and how the script asked so that it reads as part of
 * the picture. Dialogue is the viewer's, and takes the caption preferences they set — those exist so
 * that somebody who needs large lettering on a solid ground can read at all, and a file is not
 * entitled to overrule that.
 *
 * @param src - The subtitle file to read as WebVTT.
 * @param cuesSrc - Where to ask for the same track as styled lines, for a track that has them.
 * @param atSeconds - Where playback is up to, offset included.
 * @param style - How this viewer likes captions drawn.
 * @param isLifted - Whether the controls are up and dialogue should sit above them.
 */
const SubtitleCues = ({ src, cuesSrc, atSeconds, style, isLifted = false }: SubtitleCuesProps) => {
  const [cues, setCues] = useState<readonly SubtitleCue[]>([]);

  useEffect(() => {
    let dropped = false;

    setCues([]);

    const read = async (): Promise<SubtitleCue[]> => {
      const styled = cuesSrc === undefined ? null : await fetchSubtitleCues(cuesSrc);

      if (styled !== null) {
        return styled;
      }

      const text = await fetch(src)
        .then((answer) => (answer.ok ? answer.text() : ''))
        .catch(() => '');

      return asSubtitleLines(text);
    };

    void read().then((found) => {
      if (!dropped) {
        setCues(found);
      }
    });

    return () => {
      dropped = true;
    };
  }, [src, cuesSrc]);

  const said = linesAt(cues, atSeconds);

  if (said.length === 0) {
    return null;
  }

  const viewer = toCueDeclarations(style);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 [container-type:size]"
      aria-live="polite"
    >
      {said.map((cue, index) => {
        const placement = toCuePlacement(cue, isLifted ? CLEAR_OF_THE_CONTROLS : NEAR_THE_BOTTOM);

        return (
          <div
            key={`${cue.from.toString()}-${index.toString()}`}
            className="absolute flex px-[8%]"
            style={{ ...placement.box, justifyContent: placement.justify }}
          >
            <p
              className="max-w-full rounded px-2 py-0.5 leading-snug whitespace-pre-line"
              style={
                cue.isSign
                  ? { textAlign: 'center', textShadow: viewer.textShadow }
                  : { ...viewer, textAlign: 'center', fontSize: viewer.fontSize }
              }
            >
              {cue.isSign
                ? cue.spans.map((span, at) => (
                    <span key={`${at.toString()}-${span.text}`} style={toSpanStyle(span)}>
                      {span.text}
                    </span>
                  ))
                : cue.spans.map((span) => span.text).join('')}
            </p>
          </div>
        );
      })}
    </div>
  );
};

SubtitleCues.displayName = 'SubtitleCues';

export { CLEAR_OF_THE_CONTROLS, NEAR_THE_BOTTOM, SubtitleCues };
