import type { Connect } from '@ValenceClient/realtime/createRealtimeClient';

const PATH = '/api/realtime';

/**
 * Opens the real socket, against the same origin the page was served from.
 *
 * The scheme has to follow the page rather than be fixed, or a server behind TLS refuses the
 * connection while a plain one works, which looks like the feature being broken in production only.
 *
 * @param handlers - What to call as the connection opens, speaks and ends.
 * @returns The link the client drives.
 */
const openRealtimeSocket: Connect = (handlers) => {
  const scheme = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${scheme}//${globalThis.location.host}${PATH}`);

  socket.onopen = () => {
    handlers.onOpen();
  };

  socket.onmessage = (event: MessageEvent<string>) => {
    handlers.onMessage(event.data);
  };

  socket.onclose = () => {
    handlers.onClose();
  };

  socket.onerror = () => {
    socket.close();
  };

  return {
    send: (raw) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(raw);
      }
    },
    close: () => {
      socket.close();
    },
  };
};

export { openRealtimeSocket };
