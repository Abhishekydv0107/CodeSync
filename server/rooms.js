// In-memory room state. Fine for a single server instance; the Redis adapter
// (see index.js) is what makes Socket.io events fan out correctly once you
// run more than one instance — but the actual "current text" below is kept
// per-instance for simplicity. For true multi-instance correctness you'd
// move this into Redis too (e.g. a hash per room) or adopt a CRDT like Yjs.
const rooms = new Map();

export function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { code: "", language: "python", users: new Map() });
  }
  return rooms.get(roomId);
}

export function setUser(roomId, socketId, name) {
  getRoom(roomId).users.set(socketId, { name, cursor: null });
}

export function removeUser(roomId, socketId) {
  const room = rooms.get(roomId);
  if (room) room.users.delete(socketId);
}

export function listUsers(roomId) {
  const room = rooms.get(roomId);
  return room ? [...room.users.entries()].map(([id, u]) => ({ id, ...u })) : [];
}
