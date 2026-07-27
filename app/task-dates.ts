export type TaskDateStatus = "none" | "today" | "upcoming" | "overdue";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getLocalDateKey(date = new Date()) {
  const localTime = date.getTime() - date.getTimezoneOffset() * 60_000;
  return new Date(localTime).toISOString().slice(0, 10);
}

export function getDueDateKey(dueAt: string | null) {
  if (!dueAt) return null;
  const dateKey = dueAt.slice(0, 10);
  return DATE_KEY_PATTERN.test(dateKey) ? dateKey : null;
}

export function dueAtFromDateInput(dateKey: string) {
  return DATE_KEY_PATTERN.test(dateKey)
    ? `${dateKey}T12:00:00.000Z`
    : null;
}

export function getTaskDateStatus(
  dueAt: string | null,
  todayKey = getLocalDateKey(),
): TaskDateStatus {
  const dueDateKey = getDueDateKey(dueAt);
  if (!dueDateKey) return "none";
  if (dueDateKey === todayKey) return "today";
  return dueDateKey < todayKey ? "overdue" : "upcoming";
}

export function formatDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(date);
}
