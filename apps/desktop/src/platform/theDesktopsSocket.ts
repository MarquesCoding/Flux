import { serverAddress } from '@ValenceClient/session/serverAddress';
import type { Connect } from '@ValenceClient/realtime/createRealtimeClient';

const PATH = '/api/realtime';

/**
 * Opens the live connection to whichever Valence this client watches.
 *
 * Unlike everything else this client asks of a server, this one cannot go through the process that
 * owns the window: a custom scheme handles requests, and a socket is not a request. So it is opened
 * from the page, directly at the server, and the address has to be built rather than taken from the
 * page's own — the page is served from this client and the server is somewhere else entirely.
 *
 * A note on what this does not yet do. The server knows who is asking from the session cookie, and a
 * socket opened from here is cross-site, so that cookie is not sent: the connection is made and then
 * refused. Carrying it means the main process holding the socket and passing what it hears through
 * to the page, which is the honest fix and is not done here.
 *
 * @param handlers - What to call as the connection opens, speaks and ends.
 * @returns The link the client drives.
 */
const theDesktopsSocket: Connect = (handlers) => {
  const server = serverAddress();

  if (server === null) {
    return { send: () => {}, close: () => {} };
  }

  const asked = new URL(server);
  const scheme = asked.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${scheme}//${asked.host}${PATH}`);

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
    send: (message: string) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    },
    close: () => {
      socket.close();
    },
  };
};

export { theDesktopsSocket };
