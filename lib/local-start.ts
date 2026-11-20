export function localStartToUtc(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const offset = date.getTimezoneOffset();
  const wallTime = new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
  if (wallTime !== value) return null;

  // A fall-back transition can make the same wall time occur twice.
  const tomorrow = new Date(date.getTime() + 86_400_000);
  const offsetIncrease = tomorrow.getTimezoneOffset() - offset;
  if (offsetIncrease > 0 &&
      new Date(date.getTime() + offsetIncrease * 60_000).getTimezoneOffset() === tomorrow.getTimezoneOffset()) {
    return null;
  }
  return date.toISOString().slice(0, 16);
}
