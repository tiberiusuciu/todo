import { describe, expect, it } from "vitest";
import { formatDueDate } from "./formatDueDate";

describe("formatDueDate", () => {
  const now = new Date("2026-05-27T12:00:00");

  it("formats same-day evening as Tonight", () => {
    expect(formatDueDate("2026-05-27T21:00:00", now)).toBe("Tonight, 9pm");
  });

  it("formats weekday within a week", () => {
    expect(formatDueDate("2026-05-29T16:00:00", now)).toMatch(/^Fri\. 4pm$/);
  });

  it("formats later in the same year", () => {
    expect(formatDueDate("2026-06-17T17:00:00", now)).toMatch(/^Jun\. 17, 5pm$/);
  });
});
