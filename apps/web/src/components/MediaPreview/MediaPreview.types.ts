import type { ReactNode } from 'react';
import type { MoodLight } from '@FluxUI/MoodBackground.types';
type MediaPreviewProps = {
  mediaId: string;
  /**
   * Whether to fill its container rather than keep a film's shape.
   *
   * A hero is whatever height the screen is; a dialog is a rectangle the shape
   * of a film.
   */
  fills?: boolean;
  /**
   * How long to wait before starting anything.
   *
   * Opening something to read its runtime should not start a transcode.
   */
  settleMilliseconds?: number;
  /**
   * Drawn until the preview is playing, and left in place if it never does.
   */
  backdropUrl: string | null;
  /**
   * How far in to start, as a fraction of the runtime.
   */
  startFraction?: number;
  durationSeconds: number;
  /**
   * Whether the preview offers to turn its sound on.
   *
   * It always starts silent — a page that begins talking on its own is a page
   * people learn to close, and browsers refuse to autoplay with sound anyway.
   * This only decides whether there is a way to ask for it.
   */
  hasSound?: boolean;
  /**
   * Whether the clip carries the subtitles a viewer would get on pressing
   * play.
   *
   * A preview of a film in a language somebody does not read is a preview of
   * nothing.
   */
  hasSubtitles?: boolean;
  /**
   * Whether the clip runs again when it reaches the end.
   *
   * Defaults to whether anything is waiting for it to finish. A page about
   * one item has nothing to hand over to, but it does have something to go
   * back to — the picture and the words that describe it.
   */
  repeats?: boolean;
  /**
   * Called when the clip has finished.
   *
   * A hero waits for this before moving on, so it changes item from a still
   * picture rather than cutting away mid-shot.
   */
  onEnded?: () => void;
  /**
   * Called as the clip starts and stops.
   *
   * What is over a preview belongs to the still, not to the film: a page that
   * keeps its titles up once the picture is moving is a page arguing with
   * itself.
   */
  onPlayingChange?: (isPlaying: boolean) => void;
  /**
   * Called with the colours whatever is showing is made of.
   *
   * The preview owns the pixels — the clip while it runs, the still before and
   * after it — so it is the only thing that can answer what the page should be
   * lit by at this moment.
   */
  onPalette?: (lights: MoodLight[]) => void;
  /**
   * Controls of the caller's own, set beside the preview's.
   *
   * For things done to the item rather than to the clip — keeping it, say.
   * They belong in the same cluster because a viewer looking for something to
   * press should have one place to look.
   */
  actions?: ReactNode;
};

export type { MediaPreviewProps };
