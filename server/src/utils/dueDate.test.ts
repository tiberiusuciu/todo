import { describe, expect, it } from "vitest";
import {
  extractJsonObject,
  finalizeDueDateParse,
  findWeekdayOccurrence,
  isValidCleanTitleRemoval,
  parseDueDatePayload,
  parseIsoDueDate,
  resolveDueDateParse,
  tryParseDueDateFromTitle,
} from "./dueDate.js";

describe("dueDate utils", () => {
  it("extracts JSON from fenced responses", () => {
    const raw = extractJsonObject('```json\n{"cleanTitle":"Task","dueAt":"2026-05-27T16:00:00Z"}\n```');
    expect(parseDueDatePayload(raw)).toEqual({
      cleanTitle: "Task",
      dueAt: "2026-05-27T16:00:00Z",
    });
  });

  it("rejects invalid ISO dates", () => {
    expect(parseIsoDueDate("not-a-date")).toBeNull();
  });

  it("keeps original title when dueAt is null", () => {
    expect(
      resolveDueDateParse("Buy milk", { cleanTitle: "Buy", dueAt: null })
    ).toEqual({ title: "Buy milk", dueAt: null });
  });

  it("keeps original title when cleanTitle is empty", () => {
    expect(
      resolveDueDateParse("Dentist on Wed", {
        cleanTitle: "  ",
        dueAt: "2026-05-27T16:00:00Z",
      })
    ).toEqual({ title: "Dentist on Wed", dueAt: null });
  });

  it("applies clean title when dueAt is valid", () => {
    const result = resolveDueDateParse("Dentist on Wednesday at 4pm", {
      cleanTitle: "Dentist",
      dueAt: "2026-05-27T16:00:00Z",
    });
    expect(result.title).toBe("Dentist");
    expect(result.dueAt?.toISOString()).toBe("2026-05-27T16:00:00.000Z");
  });

  it("rejects clean titles that remove non-date words", () => {
    expect(
      isValidCleanTitleRemoval(
        "Movie night with my cousin on Wednesday at 7pm",
        "Movie night"
      )
    ).toBe(false);
  });

  it("parses weekday phrases deterministically", () => {
    const reference = new Date("2026-05-29T12:00:00Z");
    const result = tryParseDueDateFromTitle(
      "Movie night with my cousin on Wednesday at 7pm",
      reference,
      "UTC"
    );
    expect(result?.title).toBe("Movie night with my cousin");
    expect(result?.dueAt.getUTCDay()).toBe(3);
    expect(result?.dueAt.getUTCHours()).toBe(19);
  });

  it("uses the nearest upcoming weekday from Friday", () => {
    const reference = new Date("2026-05-29T12:00:00Z");
    const nextWednesday = findWeekdayOccurrence(3, 16, 0, reference, "UTC", "next");
    expect(nextWednesday.getUTCDay()).toBe(3);
    expect(nextWednesday.getTime()).toBeGreaterThan(reference.getTime());
  });

  it("prefers deterministic parsing over bad LLM output", () => {
    const reference = new Date("2026-05-29T12:00:00Z");
    const result = finalizeDueDateParse(
      "Movie night with my cousin on Wednesday at 7pm",
      { cleanTitle: "Movie night", dueAt: "2026-05-30T12:00:00Z" },
      reference,
      "UTC"
    );
    expect(result.title).toBe("Movie night with my cousin");
    expect(result.dueAt?.getUTCDay()).toBe(3);
  });

  it("parses calendar dates like June 5th at 3pm", () => {
    const reference = new Date("2026-05-27T12:00:00Z");
    const result = tryParseDueDateFromTitle("Groceries on June 5th at 3pm", reference, "UTC");
    expect(result?.title).toBe("Groceries");
    expect(result?.dueAt.getUTCMonth()).toBe(5);
    expect(result?.dueAt.getUTCDate()).toBe(5);
    expect(result?.dueAt.getUTCHours()).toBe(15);
  });

  it("strips next/last modifiers from the title", () => {
    const reference = new Date("2026-05-29T12:00:00Z");
    const result = tryParseDueDateFromTitle(
      "Swimming Class with Aurelius next Monday at 3pm",
      reference,
      "UTC"
    );
    expect(result?.title).toBe("Swimming Class with Aurelius");
    expect(result?.dueAt.getUTCDay()).toBe(1);
    expect(result?.dueAt.getUTCHours()).toBe(15);
  });

  it("defaults to 9am when no time is provided", () => {
    const reference = new Date("2026-05-29T12:00:00Z");
    const result = tryParseDueDateFromTitle("Review notes next Tuesday", reference, "UTC");
    expect(result?.dueAt.getUTCHours()).toBe(9);
    expect(result?.dueAt.getUTCMinutes()).toBe(0);
  });

  it("parses next week as same weekday one week out", () => {
    const reference = new Date("2026-05-29T12:00:00Z");
    const result = tryParseDueDateFromTitle("Standup next week", reference, "UTC");
    expect(result?.title).toBe("Standup");
    expect(result?.dueAt.getUTCDate()).toBe(5);
    expect(result?.dueAt.getUTCHours()).toBe(9);
  });

  it("parses next month as the first day at 9am", () => {
    const reference = new Date("2026-05-29T12:00:00Z");
    const result = tryParseDueDateFromTitle("Budget review next month", reference, "UTC");
    expect(result?.title).toBe("Budget review");
    expect(result?.dueAt.getUTCMonth()).toBe(5);
    expect(result?.dueAt.getUTCDate()).toBe(1);
    expect(result?.dueAt.getUTCHours()).toBe(9);
  });

  it("parses leading date phrase with comma separator", () => {
    const reference = new Date("2026-05-28T12:00:00Z");
    const result = tryParseDueDateFromTitle(
      "This Friday at 7pm, lunch with parents",
      reference,
      "UTC"
    );
    expect(result?.title).toBe("lunch with parents");
    expect(result?.dueAt.getUTCDay()).toBe(5);
    expect(result?.dueAt.getUTCHours()).toBe(19);
  });

  it("parses leading date phrase with space boundary", () => {
    const reference = new Date("2026-05-28T12:00:00Z");
    const result = tryParseDueDateFromTitle(
      "This Friday at 7pm lunch with parents",
      reference,
      "UTC"
    );
    expect(result?.title).toBe("lunch with parents");
    expect(result?.dueAt.getUTCHours()).toBe(19);
  });

  it("parses trailing this weekday", () => {
    const reference = new Date("2026-05-28T12:00:00Z");
    const result = tryParseDueDateFromTitle(
      "lunch with parents this Friday at 7pm",
      reference,
      "UTC"
    );
    expect(result?.title).toBe("lunch with parents");
    expect(result?.dueAt.getUTCDay()).toBe(5);
    expect(result?.dueAt.getUTCHours()).toBe(19);
  });

  it("parses vague noon time on trailing weekday", () => {
    const reference = new Date("2026-05-27T12:00:00Z");
    const result = tryParseDueDateFromTitle("pizza with friends Thursday at noon", reference, "UTC");
    expect(result?.title).toBe("pizza with friends");
    expect(result?.dueAt.getUTCDay()).toBe(4);
    expect(result?.dueAt.getUTCHours()).toBe(12);
  });

  it("maps vague time words to concrete hours", () => {
    const reference = new Date("2026-05-27T12:00:00Z");
    const cases = [
      { title: "Task Monday morning", hour: 9 },
      { title: "Task Tuesday afternoon", hour: 14 },
      { title: "Task Wednesday evening", hour: 18 },
      { title: "Task Thursday night", hour: 21 },
    ];
    for (const { title, hour } of cases) {
      const result = tryParseDueDateFromTitle(title, reference, "UTC");
      expect(result?.dueAt.getUTCHours()).toBe(hour);
    }
  });

  it("does not parse ambiguous titles without time or separator", () => {
    const reference = new Date("2026-05-27T12:00:00Z");
    expect(tryParseDueDateFromTitle("Friday report", reference, "UTC")).toBeNull();
  });

  it("parses leading relative with vague time", () => {
    const reference = new Date("2026-05-27T12:00:00Z");
    const result = tryParseDueDateFromTitle("Tomorrow morning, buy milk", reference, "UTC");
    expect(result?.title).toBe("buy milk");
    expect(result?.dueAt.getUTCDate()).toBe(28);
    expect(result?.dueAt.getUTCHours()).toBe(9);
  });
});
