import {
  extractJsonObject,
  formatReferenceDateTime,
  finalizeDueDateParse,
  parseDueDatePayload,
  type DueDateParsePayload,
} from "../utils/dueDate.js";

const TIMEOUT_MS = 15_000;

function getOllamaConfig() {
  return {
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://ollama:11434",
    model: process.env.OLLAMA_MODEL ?? "llama3.2:1b",
  };
}

function buildPrompt(title: string, referenceDate: Date, timezone: string): string {
  const now = formatReferenceDateTime(referenceDate, timezone);
  return `You extract due dates from todo task titles. Current datetime in the user's timezone (${timezone}): ${now}

Reply with JSON only, no markdown:
{"cleanTitle": string | null, "dueAt": string | null}

Rules:
- Only remove the date/time phrase from the title. Keep all other words (people, places, context).
- cleanTitle must be the original title minus one contiguous date/time phrase, usually at the end.
- Never drop unrelated words. "Movie night with my cousin on Wednesday at 7pm" -> "Movie night with my cousin"
- For bare weekdays (Monday, Wed, etc.) without a modifier, pick the nearest upcoming occurrence.
- "next Monday/Tuesday/..." means that weekday in the following calendar week (not the nearest one).
- "last/past/previous Monday" means the most recent past occurrence; include "last/next" in the removed phrase.
- "next week" means the same weekday one week from now. "next month/year/June" means the start of that period.
- If no time is given, default to 9:00 AM.
- For absolute calendar dates ("June 5th at 3pm"), use that exact date unless it already passed this year, then use next year.

Examples:
"Dentist appointment on Wednesday at 4pm" -> {"cleanTitle":"Dentist appointment","dueAt":"<next Wednesday 4pm ISO>"}
"Swimming Class with Aurelius next Monday at 3pm" -> {"cleanTitle":"Swimming Class with Aurelius","dueAt":"<Monday after the upcoming one, 3pm ISO>"}
"Movie night with my cousin on Wednesday at 7pm" -> {"cleanTitle":"Movie night with my cousin","dueAt":"<next Wednesday 7pm ISO>"}
"Groceries on June 5th at 3pm" -> {"cleanTitle":"Groceries","dueAt":"<June 5 3pm ISO>"}
"Budget review next month" -> {"cleanTitle":"Budget review","dueAt":"<first day of next month 9am ISO>"}
"Buy groceries" -> {"cleanTitle": null, "dueAt": null}
"Finish report by Friday" -> {"cleanTitle":"Finish report","dueAt":"<next Friday ISO>"}
- If there is no clear date/time, return {"cleanTitle": null, "dueAt": null}.
- If unsure, return {"cleanTitle": null, "dueAt": null}.
- dueAt must be ISO 8601 with timezone offset.

Task title: "${title}"`;
}

export type DueDateParseResult = {
  title: string;
  dueAt: Date | null;
};

export async function parseDueDate(
  title: string,
  referenceDate: Date,
  timezone: string
): Promise<DueDateParseResult> {
  const trimmed = title.trim();
  if (!trimmed) return { title: trimmed, dueAt: null };

  const { baseUrl, model } = getOllamaConfig();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: buildPrompt(trimmed, referenceDate, timezone),
        stream: false,
        options: { temperature: 0.1, num_predict: 256 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn("Ollama due date request failed:", res.status);
      return finalizeDueDateParse(trimmed, null, referenceDate, timezone);
    }

    const data = (await res.json()) as { response?: string };
    const raw = extractJsonObject(data.response ?? "");
    const payload = parseDueDatePayload(raw) as DueDateParsePayload | null;
    return finalizeDueDateParse(trimmed, payload, referenceDate, timezone);
  } catch (err) {
    console.warn("Due date parsing failed:", err);
    return finalizeDueDateParse(trimmed, null, referenceDate, timezone);
  }
}
