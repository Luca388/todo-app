type ErrorRecord = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  message?: unknown;
};

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getErrorMessage(
  error: unknown,
  fallback = "알 수 없는 오류가 발생했습니다.",
) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (!error || typeof error !== "object") return fallback;

  const record = error as ErrorRecord;
  const message = readText(record.message);
  const code = readText(record.code);
  const details = readText(record.details);
  const hint = readText(record.hint);
  if (!message && !details && !hint) return fallback;

  const primary = message ?? details ?? hint ?? fallback;
  const suffix = [
    code ? `오류 코드: ${code}` : null,
    details && details !== primary ? details : null,
    hint && hint !== primary ? hint : null,
  ].filter((value): value is string => Boolean(value));

  return suffix.length > 0 ? `${primary} (${suffix.join(" · ")})` : primary;
}
