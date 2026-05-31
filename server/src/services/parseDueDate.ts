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
- The date/time phrase may appear at the start or end of the title.
- cleanTitle must be the original title minus one contiguous date/time phrase.
- Never drop unrelated words. "Movie night with my cousin on Wednesday at 7pm" -> "Movie night with my cousin"
- For bare weekdays (Monday, Wed, etc.) without a modifier, pick the nearest upcoming occurrence.
- "this Friday" means Friday in the current calendar week.
- "next Monday/Tuesday/..." means that weekday in the following calendar week (not the nearest one).
- "last/past/previous Monday" means the most recent past occurrence; include "last/next/this" in the removed phrase.
- "next week" means the same weekday one week from now. "next month/year/June" means the start of that period.
- Vague times: morning=9am, noon/midday=12pm, afternoon=2pm, evening=6pm, night=9pm.
- If no time is given, default to 9:00 AM.
- For absolute calendar dates ("June 5th at 3pm"), use that exact date unless it already passed this year, then use next year.
- If there is no clear date/time, return {"cleanTitle": null, "dueAt": null}.
- If unsure, return {"cleanTitle": null, "dueAt": null}.
- dueAt must be ISO 8601 with timezone offset.

Examples:
"This Friday at 7pm, lunch with parents" -> {"cleanTitle":"lunch with parents","dueAt":"<this Friday 7pm ISO>"}
"pizza with friends Thursday at noon" -> {"cleanTitle":"pizza with friends","dueAt":"<Thursday 12pm ISO>"}
"Dentist appointment on Wednesday at 4pm" -> {"cleanTitle":"Dentist appointment","dueAt":"<next Wednesday 4pm ISO>"}
"Swimming Class with Aurelius next Monday at 3pm" -> {"cleanTitle":"Swimming Class with Aurelius","dueAt":"<Monday after the upcoming one, 3pm ISO>"}
"Groceries on June 5th at 3pm" -> {"cleanTitle":"Groceries","dueAt":"<June 5 3pm ISO>"}
"Budget review next month" -> {"cleanTitle":"Budget review","dueAt":"<first day of next month 9am ISO>"}
"Buy groceries" -> {"cleanTitle": null, "dueAt": null}

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
