import { useEffect, useState } from 'react';
import { cueAt, parseWebVtt } from '@FluxScreens/playback/parseWebVtt';
import { toCueDeclarations } from '@FluxScreens/playback/captionStyle';
import type { Cue } from '@FluxScreens/playback/parseWebVtt';
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
 * @param src - The subtitle file to read.
 * @param atSeconds - Where playback is up to, offset included.
 * @param style - How this viewer likes captions drawn.
 * @param isLifted - Whether the controls are up and the line should sit above them.
 */
const SubtitleCues = ({ src, atSeconds, style, isLifted = false }: SubtitleCuesProps) => {
  const [cues, setCues] = useState<readonly Cue[]>([]);

  useEffect(() => {
    let dropped = false;

    setCues([]);

    void fetch(src)
      .then((answer) => (answer.ok ? answer.text() : ''))
      .catch(() => '')
      .then((text) => {
        if (!dropped) {
          setCues(parseWebVtt(text));
        }
      });

    return () => {
      dropped = true;
    };
  }, [src]);

  const said = cueAt(cues, atSeconds);

  if (said === null) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-[8%] text-center"
      style={{ bottom: isLifted ? CLEAR_OF_THE_CONTROLS : NEAR_THE_BOTTOM }}
    >
      <p
        className="max-w-full rounded px-2 py-0.5 text-[clamp(1rem,2.6vw,2rem)] leading-snug whitespace-pre-line"
        style={toCueDeclarations(style)}
      >
        {said.text}
      </p>
    </div>
  );
};

SubtitleCues.displayName = 'SubtitleCues';

export { CLEAR_OF_THE_CONTROLS, NEAR_THE_BOTTOM, SubtitleCues };
