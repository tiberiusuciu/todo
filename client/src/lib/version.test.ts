import { describe, expect, it } from "vitest";
import { isClientOutdated, parseVersion } from "./version";

describe("parseVersion", () => {
  it("parses semver strings", () => {
    expect(parseVersion("1.5.0")).toEqual([1, 5, 0]);
  });

  it("rejects invalid strings", () => {
    expect(parseVersion("1.5")).toBeNull();
    expect(parseVersion("v1.5.0")).toBeNull();
    expect(parseVersion("")).toBeNull();
  });
});

describe("isClientOutdated", () => {
  it("returns false for equal versions", () => {
    expect(isClientOutdated("1.5.0", "1.5.0")).toBe(false);
  });

  it("returns true when server is newer", () => {
    expect(isClientOutdated("1.5.0", "1.5.1")).toBe(true);
    expect(isClientOutdated("1.5.0", "1.6.0")).toBe(true);
    expect(isClientOutdated("1.5.0", "2.0.0")).toBe(true);
  });

  it("returns false when client is ahead", () => {
    expect(isClientOutdated("1.6.0", "1.5.0")).toBe(false);
  });

  it("returns false for invalid versions", () => {
    expect(isClientOutdated("bad", "1.6.0")).toBe(false);
    expect(isClientOutdated("1.5.0", "bad")).toBe(false);
  });
});
