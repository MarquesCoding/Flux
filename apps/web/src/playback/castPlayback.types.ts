/**
 * The part of AirPlay that TypeScript's description of the DOM leaves out.
 *
 * Safari's route picker predates the standard one and has never been
 * standardised, so it is written down here rather than reached for through a
 * cast. Everything is optional because every other browser lacks all of it.
 */
declare global {
  interface HTMLVideoElement {
    webkitShowPlaybackTargetPicker?: () => void;
    /**
     * Whether this element is currently playing somewhere else.
     */
    webkitCurrentPlaybackTargetIsWireless?: boolean;
  }
}

/**
 * Where a viewer's playback currently is.
 *
 * `unavailable` means nothing on the network can take it — usually because the
 * browser has no route to offer, or because the page is being read on the
 * machine the server is running on, where a television has nowhere to fetch
 * from.
 */
type CastState = 'unavailable' | 'available' | 'connecting' | 'connected';

export type { CastState };
