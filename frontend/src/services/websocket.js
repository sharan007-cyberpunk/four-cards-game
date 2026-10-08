import {Client} from '@stomp/stompjs';
import {useEffect, useMemo} from 'react';
import {API} from './api.js';

const WS = import.meta.env.VITE_WS_URL || API.replace(/^http/, 'ws') + '/ws';

export function useGameSocket(roomCode, playerId, onPublic, onPrivate, onError) {
  useEffect(() => {
    if (!roomCode || !playerId) return undefined;

    const client = new Client({
      brokerURL: WS,
      connectHeaders: {'player-id': playerId},
      reconnectDelay: 1500,
      debug: () => {}
    });

    const publishConnection = type => {
      window.dispatchEvent(new CustomEvent(`fourcards:stomp-${type}`, {
        detail: {client, roomCode, playerId}
      }));
    };

    client.onConnect = () => {
      window.__fourCardsClient = client;

      client.subscribe(
        `/topic/rooms/${roomCode}`,
        message => onPublic(JSON.parse(message.body))
      );

      client.subscribe(
        '/user/queue/private',
        message => onPrivate(JSON.parse(message.body))
      );

      publishConnection('connected');
    };

    client.onStompError = frame => {
      onError(frame.headers?.message || 'WebSocket error');
    };

    client.onWebSocketClose = () => {
      publishConnection('closed');
      onPublic({connection: 'disconnected'});
    };

    client.onWebSocketError = () => {
      onError('WebSocket connection error.');
    };

    client.activate();

    return () => {
      publishConnection('closed');
      if (window.__fourCardsClient === client) {
        window.__fourCardsClient = null;
      }
      client.deactivate();
    };
  }, [roomCode, playerId, onError, onPrivate, onPublic]);

  return useMemo(
    () => ({
      send: (destination, body) => {
        const client = window.__fourCardsClient;

        if (!client?.connected) {
          onError('Connection is not ready.');
          return;
        }

        client.publish({
          destination: `/app${destination}`,
          body: JSON.stringify(body)
        });
      }
    }),
    [onError]
  );
}
