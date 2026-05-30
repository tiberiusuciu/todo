function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: date.getMinutes() === 0 ? undefined : "2-digit",
    hour12: true,
  })
    .format(date)
    .toLowerCase()
    .replace(":00", "")
    .replace(" ", "");
}

export function formatDueDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const dayDiff = Math.round(
    (startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000
  );

  const time = formatTime(date);

  if (dayDiff === 0) {
    const hour = date.getHours();
    const label = hour >= 17 ? "Tonight" : "Today";
    return `${label}, ${time}`;
  }

  if (dayDiff === 1) {
    return `Tomorrow, ${time}`;
  }

  if (dayDiff > 1 && dayDiff < 7) {
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
    return `${weekday}. ${time}`;
  }

  if (date.getFullYear() === now.getFullYear()) {
    const month = new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
    const day = new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(date);
    return `${month}. ${day}, ${time}`;
  }

  const full = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
  return `${full}, ${time}`;
}

export function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
