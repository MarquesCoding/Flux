import { serverAddress } from '@FluxClient/session/serverAddress';
import type { Connect } from '@FluxClient/realtime/createRealtimeClient';

const PATH = '/api/realtime';

/**
 * Turns the address this client watches into the one its socket is opened on.
 *
 * A browser derives this from the page it was served, which a desktop client cannot: its pages come
 * from itself. It uses the address somebody gave it, over the matching scheme — a server reached
 * over TLS refuses a plain socket, and one without a certificate has no TLS to offer.
 *
 * @param address - Where this client was told its Flux is.
 * @returns The socket address.
 */
const socketAddressOf = (address: string): string =>
  `${address.replace(/^http/, 'ws')}${PATH}`;

/**
 * Opens the real socket, against the server this client was told to watch.
 *
 * @param handlers - What to call as the connection opens, speaks and ends.
 * @returns The link the client drives.
 */
const openRealtimeSocket: Connect = (handlers) => {
  const address = serverAddress();

  if (address === null) {
    throw new Error('This client has not been told where its server is.');
  }

  const socket = new WebSocket(socketAddressOf(address));

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

export { openRealtimeSocket, socketAddressOf };
