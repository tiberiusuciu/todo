export type DueDateParsePayload = {
  cleanTitle: string | null;
  dueAt: string | null;
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
};

const WEEKDAY_TO_DOW: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const WEEKDAY_PATTERN =
  "sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat";

const MONTH_PATTERN =
  "january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec";

const MONTH_TO_NUM: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const TIME_PATTERN = "(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)|\\d{1,2}:\\d{2})";

export const DEFAULT_DUE_HOUR = 9;
export const DEFAULT_DUE_MINUTE = 0;

const OPTIONAL_TIME_SUFFIX = `(?:\\s+(?:at\\s+)?${TIME_PATTERN})?`;

const WEEKDAY_TRAILING_RE = new RegExp(
  `[\\s,]+(?:(?:on|by|at|before)\\s+)?(?:(next|last|past|previous)\\s+)?(${WEEKDAY_PATTERN})${OPTIONAL_TIME_SUFFIX}\\s*$`,
  "i"
);

const RELATIVE_TRAILING_RE = new RegExp(
  `[\\s,]+(?:(?:on|by|at)\\s+)?(today|tonight|tomorrow)${OPTIONAL_TIME_SUFFIX}\\s*$`,
  "i"
);

const CALENDAR_TRAILING_RE = new RegExp(
  `[\\s,]+(?:(?:on|by|at)\\s+)?(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?${OPTIONAL_TIME_SUFFIX}\\s*$`,
  "i"
);

const NEXT_WEEK_TRAILING_RE = new RegExp(
  `[\\s,]+(?:(?:on|by|at|in)\\s+)?next\\s+week${OPTIONAL_TIME_SUFFIX}\\s*$`,
  "i"
);

const NEXT_PERIOD_TRAILING_RE = new RegExp(
  `[\\s,]+(?:(?:on|by|at|in)\\s+)?next\\s+(month|year|${MONTH_PATTERN})${OPTIONAL_TIME_SUFFIX}\\s*$`,
  "i"
);

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function parseDueDatePayload(raw: unknown): DueDateParsePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const cleanTitle =
    obj.cleanTitle === null ? null : typeof obj.cleanTitle === "string" ? obj.cleanTitle : null;
  const dueAt = obj.dueAt === null ? null : typeof obj.dueAt === "string" ? obj.dueAt : null;
  if (obj.cleanTitle !== null && typeof obj.cleanTitle !== "string") return null;
  if (obj.dueAt !== null && typeof obj.dueAt !== "string") return null;
  return { cleanTitle, dueAt };
}

export function parseIsoDueDate(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts: Record<string, number | string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type === "literal") continue;
    parts[p.type] = p.type === "weekday" ? p.value : Number(p.value);
  }
  return parts as ZonedParts;
}

function weekdayNameToDow(name: string): number | null {
  const key = name.trim().slice(0, 3).toLowerCase();
  return WEEKDAY_TO_DOW[key] ?? null;
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let adjust = -18; adjust <= 18; adjust++) {
    const candidate = new Date(guess + adjust * 3_600_000);
    const parts = getZonedParts(candidate, timeZone);
    if (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === hour &&
      parts.minute === minute
    ) {
      return candidate;
    }
  }
  return new Date(guess);
}

function monthNameToNumber(name: string): number | null {
  const key = name.trim().slice(0, 3).toLowerCase();
  return MONTH_TO_NUM[key] ?? null;
}

function resolveCalendarDate(
  month: number,
  day: number,
  hour: number,
  minute: number,
  referenceDate: Date,
  timeZone: string
): Date | null {
  if (day < 1 || day > 31) return null;

  const refParts = getZonedParts(referenceDate, timeZone);
  let year = refParts.year;
  let candidate = zonedTimeToUtc(year, month, day, hour, minute, timeZone);

  if (candidate.getTime() <= referenceDate.getTime()) {
    candidate = zonedTimeToUtc(year + 1, month, day, hour, minute, timeZone);
  }

  const resolved = getZonedParts(candidate, timeZone);
  if (resolved.month !== month || resolved.day !== day) return null;

  return candidate;
}

function matchTrailingDatePhrase(title: string): RegExpMatchArray | null {
  return (
    title.match(WEEKDAY_TRAILING_RE) ??
    title.match(NEXT_WEEK_TRAILING_RE) ??
    title.match(NEXT_PERIOD_TRAILING_RE) ??
    title.match(RELATIVE_TRAILING_RE) ??
    title.match(CALENDAR_TRAILING_RE)
  );
}

function defaultDueTime(timeToken: string | undefined): { hour: number; minute: number } {
  return parseTimeToken(timeToken) ?? { hour: DEFAULT_DUE_HOUR, minute: DEFAULT_DUE_MINUTE };
}

function findNextCalendarWeekWeekday(
  targetDow: number,
  hour: number,
  minute: number,
  referenceDate: Date,
  timeZone: string
): Date {
  const upcoming = findWeekdayOccurrence(
    targetDow,
    hour,
    minute,
    referenceDate,
    timeZone,
    "next"
  );
  const parts = getZonedParts(upcoming, timeZone);
  const nextWeek = addCalendarDays(parts, 7);
  return zonedTimeToUtc(nextWeek.year, nextWeek.month, nextWeek.day, hour, minute, timeZone);
}

function resolveWeekdayDueDate(
  weekdayName: string,
  modifier: string | undefined,
  timeToken: string | undefined,
  referenceDate: Date,
  timeZone: string
): Date | null {
  const dow = weekdayNameToDow(weekdayName);
  if (dow === null) return null;

  const { hour, minute } = defaultDueTime(timeToken);
  const mod = modifier?.toLowerCase();

  if (mod === "last" || mod === "past" || mod === "previous") {
    return findWeekdayOccurrence(dow, hour, minute, referenceDate, timeZone, "previous");
  }
  if (mod === "next") {
    return findNextCalendarWeekWeekday(dow, hour, minute, referenceDate, timeZone);
  }
  return findWeekdayOccurrence(dow, hour, minute, referenceDate, timeZone, "next");
}

function resolveNextWeek(
  timeToken: string | undefined,
  referenceDate: Date,
  timeZone: string
): Date {
  const { hour, minute } = defaultDueTime(timeToken);
  const refParts = getZonedParts(referenceDate, timeZone);
  const nextWeek = addCalendarDays(refParts, 7);
  return zonedTimeToUtc(nextWeek.year, nextWeek.month, nextWeek.day, hour, minute, timeZone);
}

function resolveNextMonth(
  timeToken: string | undefined,
  referenceDate: Date,
  timeZone: string
): Date {
  const { hour, minute } = defaultDueTime(timeToken);
  const refParts = getZonedParts(referenceDate, timeZone);
  let month = refParts.month + 1;
  let year = refParts.year;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return zonedTimeToUtc(year, month, 1, hour, minute, timeZone);
}

function resolveNextYear(
  timeToken: string | undefined,
  referenceDate: Date,
  timeZone: string
): Date {
  const { hour, minute } = defaultDueTime(timeToken);
  const refParts = getZonedParts(referenceDate, timeZone);
  return zonedTimeToUtc(refParts.year + 1, 1, 1, hour, minute, timeZone);
}

function resolveNextNamedMonth(
  monthName: string,
  timeToken: string | undefined,
  referenceDate: Date,
  timeZone: string
): Date | null {
  const month = monthNameToNumber(monthName);
  if (month === null) return null;

  const { hour, minute } = defaultDueTime(timeToken);
  const refParts = getZonedParts(referenceDate, timeZone);
  let year = refParts.year;
  let candidate = zonedTimeToUtc(year, month, 1, hour, minute, timeZone);
  if (candidate.getTime() <= referenceDate.getTime()) {
    candidate = zonedTimeToUtc(year + 1, month, 1, hour, minute, timeZone);
  }
  return candidate;
}

function addCalendarDays(
  parts: Pick<ZonedParts, "year" | "month" | "day">,
  days: number
): Pick<ZonedParts, "year" | "month" | "day"> {
  const d = new Date(parts.year, parts.month - 1, parts.day + days);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export function parseTimeToken(token: string | undefined): { hour: number; minute: number } | null {
  if (!token) return null;
  const match = token.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;

  return { hour, minute };
}

export function findWeekdayOccurrence(
  targetDow: number,
  hour: number,
  minute: number,
  referenceDate: Date,
  timeZone: string,
  direction: "next" | "previous"
): Date {
  const refParts = getZonedParts(referenceDate, timeZone);
  const refMs = referenceDate.getTime();

  for (let offset = 0; offset <= 13; offset++) {
    const dayOffset = direction === "next" ? offset : -offset;
    if (direction === "previous" && offset === 0) continue;

    const day = addCalendarDays(refParts, dayOffset);
    const candidate = zonedTimeToUtc(day.year, day.month, day.day, hour, minute, timeZone);
    const dow = weekdayNameToDow(getZonedParts(candidate, timeZone).weekday);
    if (dow !== targetDow) continue;

    if (direction === "next" && candidate.getTime() > refMs) return candidate;
    if (direction === "previous" && candidate.getTime() < refMs) return candidate;
  }

  return zonedTimeToUtc(refParts.year, refParts.month, refParts.day, hour, minute, timeZone);
}

function resolveRelativeDay(
  token: string,
  hour: number,
  minute: number,
  referenceDate: Date,
  timeZone: string
): Date {
  const refParts = getZonedParts(referenceDate, timeZone);
  const lower = token.toLowerCase();

  let dayOffset = 0;
  if (lower === "tomorrow") dayOffset = 1;
  else if (lower === "tonight" || lower === "today") dayOffset = 0;

  const day = addCalendarDays(refParts, dayOffset);
  let candidate = zonedTimeToUtc(day.year, day.month, day.day, hour, minute, timeZone);

  if (candidate.getTime() <= referenceDate.getTime()) {
    const nextDay = addCalendarDays(day, 1);
    candidate = zonedTimeToUtc(nextDay.year, nextDay.month, nextDay.day, hour, minute, timeZone);
  }

  return candidate;
}

export function stripTrailingDatePhrase(title: string): string | null {
  const match = matchTrailingDatePhrase(title);
  if (!match?.index || match.index <= 0) return null;
  return title.slice(0, match.index).replace(/[,\s]+$/, "").trim();
}

export function looksLikeDateTimePhrase(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  const hasWeekday = new RegExp(`\\b(?:${WEEKDAY_PATTERN})\\b`, "i").test(t);
  const hasRelative = /\b(today|tonight|tomorrow|next\s+week|next\s+month|next\s+year)\b/i.test(t);
  const hasModifier = /\b(next|last|past|previous)\b/i.test(t);
  const hasMonthDay = new RegExp(`\\b(?:${MONTH_PATTERN})\\s+\\d{1,2}`, "i").test(t);
  const hasNamedMonth = new RegExp(`\\bnext\\s+(?:${MONTH_PATTERN})\\b`, "i").test(t);
  const hasTime = new RegExp(TIME_PATTERN, "i").test(t);
  const hasGlue = /\b(on|by|at|before|in)\b/i.test(t);

  return (
    (hasWeekday || hasRelative || hasMonthDay || hasNamedMonth) &&
    (hasTime || hasGlue || hasRelative || hasMonthDay || hasNamedMonth || hasModifier)
  );
}

export function isValidCleanTitleRemoval(original: string, clean: string): boolean {
  const stripped = stripTrailingDatePhrase(original);
  if (stripped) return clean.trim().toLowerCase() === stripped.toLowerCase();

  const trimmedOriginal = original.trim();
  const trimmedClean = clean.trim();
  if (trimmedClean === trimmedOriginal) return true;

  const idx = trimmedOriginal.toLowerCase().indexOf(trimmedClean.toLowerCase());
  if (idx === -1) return false;

  const removed = `${trimmedOriginal.slice(0, idx)}${trimmedOriginal.slice(idx + trimmedClean.length)}`
    .replace(/\s+/g, " ")
    .trim();
  if (!removed) return true;
  return looksLikeDateTimePhrase(removed);
}

export function tryParseDueDateFromTitle(
  title: string,
  referenceDate: Date,
  timeZone: string
): { title: string; dueAt: Date } | null {
  const trimmed = title.trim();
  const weekdayMatch = trimmed.match(WEEKDAY_TRAILING_RE);
  const nextWeekMatch = weekdayMatch ? null : trimmed.match(NEXT_WEEK_TRAILING_RE);
  const nextPeriodMatch =
    weekdayMatch || nextWeekMatch ? null : trimmed.match(NEXT_PERIOD_TRAILING_RE);
  const relativeMatch =
    weekdayMatch || nextWeekMatch || nextPeriodMatch ? null : trimmed.match(RELATIVE_TRAILING_RE);
  const calendarMatch =
    weekdayMatch || nextWeekMatch || nextPeriodMatch || relativeMatch
      ? null
      : trimmed.match(CALENDAR_TRAILING_RE);
  const match = weekdayMatch ?? nextWeekMatch ?? nextPeriodMatch ?? relativeMatch ?? calendarMatch;
  if (!match?.index || match.index <= 0) return null;

  const cleanTitle = trimmed.slice(0, match.index).replace(/[,\s]+$/, "").trim();
  if (!cleanTitle) return null;

  if (weekdayMatch) {
    const dueAt = resolveWeekdayDueDate(
      weekdayMatch[2],
      weekdayMatch[1],
      weekdayMatch[3],
      referenceDate,
      timeZone
    );
    if (!dueAt) return null;
    return { title: cleanTitle, dueAt };
  }

  if (nextWeekMatch) {
    const dueAt = resolveNextWeek(nextWeekMatch[1], referenceDate, timeZone);
    return { title: cleanTitle, dueAt };
  }

  if (nextPeriodMatch) {
    const token = nextPeriodMatch[1].toLowerCase();
    const timeToken = nextPeriodMatch[2];
    let dueAt: Date | null = null;
    if (token === "month") {
      dueAt = resolveNextMonth(timeToken, referenceDate, timeZone);
    } else if (token === "year") {
      dueAt = resolveNextYear(timeToken, referenceDate, timeZone);
    } else {
      dueAt = resolveNextNamedMonth(nextPeriodMatch[1], timeToken, referenceDate, timeZone);
    }
    if (!dueAt) return null;
    return { title: cleanTitle, dueAt };
  }

  if (calendarMatch) {
    const month = monthNameToNumber(calendarMatch[1]);
    const day = Number(calendarMatch[2]);
    const parsedTime = defaultDueTime(calendarMatch[3]);
    if (month === null) return null;
    const dueAt = resolveCalendarDate(
      month,
      day,
      parsedTime.hour,
      parsedTime.minute,
      referenceDate,
      timeZone
    );
    if (!dueAt) return null;
    return { title: cleanTitle, dueAt };
  }

  const parsedTime = defaultDueTime(relativeMatch![2]);
  const dueAt = resolveRelativeDay(
    relativeMatch![1],
    parsedTime.hour,
    parsedTime.minute,
    referenceDate,
    timeZone
  );
  return { title: cleanTitle, dueAt };
}

function safeCleanTitle(original: string, llmClean: string | null | undefined): string | null {
  const stripped = stripTrailingDatePhrase(original);
  if (stripped && stripped !== original.trim()) return stripped;

  const clean = llmClean?.trim();
  if (!clean) return null;
  if (!isValidCleanTitleRemoval(original, clean)) return stripped ?? null;
  return clean;
}

export function finalizeDueDateParse(
  originalTitle: string,
  payload: DueDateParsePayload | null,
  referenceDate: Date,
  timeZone: string
): { title: string; dueAt: Date | null } {
  const trimmed = originalTitle.trim();
  const deterministic = tryParseDueDateFromTitle(trimmed, referenceDate, timeZone);
  if (deterministic) return deterministic;

  if (!payload?.dueAt) return { title: trimmed, dueAt: null };

  let dueAt = parseIsoDueDate(payload.dueAt);
  if (!dueAt) return { title: trimmed, dueAt: null };

  const match = trimmed.match(WEEKDAY_TRAILING_RE);
  if (match?.[2]) {
    const corrected = resolveWeekdayDueDate(match[2], match[1], match[3], referenceDate, timeZone);
    if (corrected) dueAt = corrected;
  }

  const cleanTitle = safeCleanTitle(trimmed, payload.cleanTitle);
  if (!cleanTitle) return { title: trimmed, dueAt: null };

  return { title: cleanTitle, dueAt };
}

export function resolveDueDateParse(
  originalTitle: string,
  payload: DueDateParsePayload | null
): { title: string; dueAt: Date | null } {
  const trimmedOriginal = originalTitle.trim();
  if (!payload?.dueAt) {
    return { title: trimmedOriginal, dueAt: null };
  }

  const dueAt = parseIsoDueDate(payload.dueAt);
  if (!dueAt) {
    return { title: trimmedOriginal, dueAt: null };
  }

  const cleanTitle = payload.cleanTitle?.trim();
  if (!cleanTitle) {
    return { title: trimmedOriginal, dueAt: null };
  }

  return { title: cleanTitle, dueAt };
}

export function formatReferenceDateTime(date: Date, timezone: string): string {
  try {
    const parts = getZonedParts(date, timezone);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(
      date
    );
    return `${weekday}, ${parts.month}/${parts.day}/${parts.year} ${parts.hour}:${String(parts.minute).padStart(2, "0")} (${timezone})`;
  } catch {
    return date.toISOString();
  }
}
