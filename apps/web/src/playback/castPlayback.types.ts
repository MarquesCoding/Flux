declare global {
  interface HTMLVideoElement {
    webkitShowPlaybackTargetPicker?: () => void;
    webkitCurrentPlaybackTargetIsWireless?: boolean;
  }
}

type CastState = 'unavailable' | 'available' | 'connecting' | 'connected';

export type { CastState };
