import { WebSocket } from "ws";

export type TodosChangedEvent = {
  type: "todos:changed";
  at: string;
};

const userRooms = new Map<string, Set<WebSocket>>();

export function joinUserRoom(userId: string, ws: WebSocket) {
  let room = userRooms.get(userId);
  if (!room) {
    room = new Set();
    userRooms.set(userId, room);
  }
  room.add(ws);
}

export function leaveUserRoom(userId: string, ws: WebSocket) {
  const room = userRooms.get(userId);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) userRooms.delete(userId);
}

export function broadcastTodosChanged(userId: string, event: TodosChangedEvent) {
  const room = userRooms.get(userId);
  if (!room) return;
  const payload = JSON.stringify(event);
  for (const ws of room) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

export function clearUserRoomsForTests() {
  userRooms.clear();
}
