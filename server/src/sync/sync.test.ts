import http from "http";
import type { AddressInfo } from "net";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import WebSocket from "ws";
import { createApp } from "../app.js";
import { attachSyncServer } from "./wsServer.js";
import { clearUserRoomsForTests } from "./broadcast.js";

function createTestServer() {
  const app = createApp();
  const server = http.createServer(app);
  attachSyncServer(server);
  return { app, server };
}

function listen(server: http.Server) {
  return new Promise<{ port: number }>((resolve) => {
    server.listen(0, () => {
      resolve({ port: (server.address() as AddressInfo).port });
    });
  });
}

async function registerWithCookie(app: ReturnType<typeof createApp>, email: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/register").send({ email, password: "password123" });
  const cookie = (res.headers["set-cookie"]?.[0] ?? "").split(";")[0];
  return { agent, cookie };
}

function openSync(port: number, cookie: string) {
  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/sync`, { headers: { Cookie: cookie } });
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitForMessage(ws: WebSocket, ms = 3000) {
  return new Promise<{ type: string }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    ws.once("message", (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(data)) as { type: string });
    });
  });
}

function expectNoMessage(ws: WebSocket, ms = 500) {
  return new Promise<null>((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    ws.once("message", () => {
      clearTimeout(timer);
      reject(new Error("unexpected message"));
    });
  });
}

describe("todo sync websocket", () => {
  afterEach(() => {
    clearUserRoomsForTests();
  });

  it("rejects unauthenticated websocket connections", async () => {
    const { server } = createTestServer();
    const { port } = await listen(server);

    await expect(
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/api/sync`);
        ws.on("open", () => reject(new Error("should not connect")));
        ws.on("error", () => resolve("rejected"));
      })
    ).resolves.toBe("rejected");

    server.close();
  });

  it("broadcasts todos:changed only to the same user", async () => {
    const { app, server } = createTestServer();
    const { port } = await listen(server);

    const userA = await registerWithCookie(app, "sync-a@example.com");
    const userB = await registerWithCookie(app, "sync-b@example.com");

    const wsA = await openSync(port, userA.cookie);
    const wsB = await openSync(port, userB.cookie);

    const waitA = waitForMessage(wsA);
    const waitB = expectNoMessage(wsB);

    await userA.agent.post("/api/todos").send({ title: "From A" });

    const msgA = await waitA;
    const msgB = await waitB;

    expect(msgA.type).toBe("todos:changed");
    expect(msgB).toBeNull();

    wsA.close();
    wsB.close();
    server.close();
  });
});
