import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

const app = createApp();

describe("GET /api/version", () => {
  it("returns semver version with no-store cache header", async () => {
    const res = await request(app).get("/api/version");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ version: expect.stringMatching(/^\d+\.\d+\.\d+$/) });
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});
