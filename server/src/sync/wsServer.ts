import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { parseCookieHeader, verifyToken } from "../middleware/auth.js";
import { joinUserRoom, leaveUserRoom } from "./broadcast.js";

const SYNC_PATH = "/api/sync";
const HEARTBEAT_MS = 30_000;

type SyncSocket = WebSocket & { userId?: string; isAlive?: boolean };

export function attachSyncServer(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = new URL(request.url ?? "", "http://localhost");
    if (pathname !== SYNC_PATH) return;

    const cookies = parseCookieHeader(request.headers.cookie);
    const user = cookies.token ? verifyToken(cookies.token) : null;
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const syncWs = ws as SyncSocket;
      syncWs.userId = user.id;
      syncWs.isAlive = true;
      joinUserRoom(user.id, syncWs);

      syncWs.on("pong", () => {
        syncWs.isAlive = true;
      });

      syncWs.on("close", () => {
        if (syncWs.userId) leaveUserRoom(syncWs.userId, syncWs);
      });
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const syncWs = ws as SyncSocket;
      if (!syncWs.isAlive) {
        syncWs.terminate();
        continue;
      }
      syncWs.isAlive = false;
      syncWs.ping();
    }
  }, HEARTBEAT_MS);

  wss.on("close", () => clearInterval(heartbeat));

  return wss;
}
