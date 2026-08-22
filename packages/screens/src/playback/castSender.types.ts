type CastMediaInfo = {
  contentId: string;
  contentType: string;
  metadata?: { title?: string };
};

type CastSession = {
  loadMedia: (request: CastLoadRequest) => Promise<void>;
  endSession: (stopCasting: boolean) => void;
  getCastDevice: () => { friendlyName?: string } | null;
};

type CastLoadRequest = {
  media: CastMediaInfo;
  currentTime?: number;
  autoplay?: boolean;
};

type CastConnectionState = 'NO_DEVICES_AVAILABLE' | 'NOT_CONNECTED' | 'CONNECTING' | 'CONNECTED';

type CastContext = {
  setOptions: (options: { receiverApplicationId: string; autoJoinPolicy: string }) => void;
  requestSession: () => Promise<void>;
  getCurrentSession: () => CastSession | null;
  getCastState: () => CastConnectionState;
  addEventListener: (event: string, listener: () => void) => void;
  removeEventListener: (event: string, listener: () => void) => void;
};

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    __valenceCastSender?: Promise<CastContext | null>;
    cast?: {
      framework: {
        CastContext: { getInstance: () => CastContext };
        CastContextEventType: { CAST_STATE_CHANGED: string };
      };
    };
    chrome?: {
      cast?: {
        media: {
          DEFAULT_MEDIA_RECEIVER_APP_ID: string;
          MediaInfo: new (contentId: string, contentType: string) => CastMediaInfo;
          LoadRequest: new (media: CastMediaInfo) => CastLoadRequest;
          GenericMediaMetadata: new () => { title?: string };
        };
        AutoJoinPolicy: { ORIGIN_SCOPED: string };
      };
    };
  }
}

type ScriptHost = {
  createElement: (tag: 'script') => HTMLScriptElement;
  head: { append: (node: HTMLScriptElement) => void };
};

type CastCarrier = {
  __onGCastApiAvailable?: (isAvailable: boolean) => void;
  __valenceCastSender?: Promise<CastContext | null>;
  cast?: {
    framework: {
      CastContext: { getInstance: () => CastContext };
      CastContextEventType: { CAST_STATE_CHANGED: string };
    };
  };
  chrome?: {
    cast?: {
      media: {
        DEFAULT_MEDIA_RECEIVER_APP_ID: string;
        MediaInfo: new (contentId: string, contentType: string) => CastMediaInfo;
        LoadRequest: new (media: CastMediaInfo) => CastLoadRequest;
        GenericMediaMetadata: new () => { title?: string };
      };
      AutoJoinPolicy: { ORIGIN_SCOPED: string };
    };
  };
};

export type {
  CastCarrier,
  CastConnectionState,
  CastContext,
  CastLoadRequest,
  CastMediaInfo,
  CastSession,
  ScriptHost,
};
