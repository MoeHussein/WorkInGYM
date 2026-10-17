const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateKey(dateKey) {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new TypeError("Expected a date in YYYY-MM-DD format.");
  }

  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime()) || toLocalDateKey(date) !== dateKey) {
    throw new TypeError("Expected a real calendar date.");
  }
  return date;
}

export function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateKey, amount) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return toLocalDateKey(date);
}

export function getMonday(dateKey) {
  const date = parseDateKey(dateKey);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return toLocalDateKey(date);
}

export function getDayIndex(dateKey) {
  const day = parseDateKey(dateKey).getDay();
  return day === 0 ? 7 : day;
}

export function differenceInCalendarDays(startDateKey, selectedDateKey) {
  const start = parseDateKey(startDateKey);
  const selected = parseDateKey(selectedDateKey);
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const selectedUtc = Date.UTC(
    selected.getFullYear(),
    selected.getMonth(),
    selected.getDate(),
  );
  return Math.round((selectedUtc - startUtc) / 86_400_000);
}

export function getProgramDayIndex(startDateKey, selectedDateKey) {
  const offset = differenceInCalendarDays(startDateKey, selectedDateKey);
  return ((offset % 7) + 7) % 7 + 1;
}

export function getProgramWeekStart(startDateKey, selectedDateKey) {
  const offset = differenceInCalendarDays(startDateKey, selectedDateKey);
  return addDays(startDateKey, Math.floor(offset / 7) * 7);
}

export function getCycleWeek(startDateKey, selectedDateKey) {
  const days = differenceInCalendarDays(startDateKey, selectedDateKey);
  if (days < 0) return 1;
  return Math.min(6, Math.floor(days / 7) + 1);
}

export function formatTimer(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}
