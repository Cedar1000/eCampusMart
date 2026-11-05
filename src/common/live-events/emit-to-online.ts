import Redis from 'ioredis';
import { Server } from 'socket.io';

// Same key the chat gateway stores each connected user's socket under. A user's
// stores point at the same socket, so a store's id reaches its owner
const onlineUserKey = (id: string) => `user-${id}`;

// Sends the event once to each socket the ids are connected on; offline ids are
// skipped
export const emitToOnline = async (
  server: Server,
  redisClient: Redis,
  ids: string[],
  event: string,
  payload: unknown,
) => {
  const clientIds = await redisClient.mget(...ids.map(onlineUserKey));

  for (const clientId of new Set(clientIds)) {
    if (clientId) server.to(clientId).emit(event, payload);
  }
};
