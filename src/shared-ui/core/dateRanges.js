// Calendar windows for the preset time ranges that are not periods on the wire.
//
// Day / month / total ship with every stats snapshot because the collector scans
// exactly those three windows. "Yesterday" and "this week" are calendar ranges in
// the same sense as a hand-picked custom range, so they resolve through
// /api/usage/range instead: no new wire field, no extra tokscale scan per tick, and
// the same aggregate-plus-detail semantics the range dialog already has.
//
// Bounds are whole local days. The upper bound is the last millisecond of the final
// day rather than the next midnight, because the desktop hosts read `to` as
// "include that whole hour" — midnight-to-midnight would leak the first hour of the
// following day into the total. The Hub rounds `to` down to a calendar day either way.

export const PRESET_RANGE_PERIODS = Object.freeze(['yesterday', 'week']);

const ISO_WEEK_FIRST_DAY = 1;

export function isPresetRangePeriod(period) {
  return PRESET_RANGE_PERIODS.includes(String(period || ''));
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function localDayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Date's day overflow handles month/year boundaries and DST: adding 1 to the 31st
// rolls over, and a 23- or 25-hour day still lands on the next calendar date.
function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/**
 * The day a week starts on, in `Date#getDay()` numbering (0 = Sunday).
 *
 * `Intl.Locale#weekInfo` carries the CLDR convention where a host ships it. It is
 * absent in the Chromium builds both clients run on, so those get the Monday
 * fallback: ISO 8601, and the convention of every non-English locale this UI ships.
 * The local calendar is the browser's either way, so the window stays consistent
 * with the day tabs beside it.
 */
export function firstDayOfWeekIndex(locale) {
  try {
    const firstDay = new Intl.Locale(String(locale || 'en')).weekInfo?.firstDay;
    if (Number.isInteger(firstDay) && firstDay >= 1 && firstDay <= 7) return firstDay % 7;
  } catch {
    // A malformed language tag must not break the scope bar.
  }
  return ISO_WEEK_FIRST_DAY;
}

export function weekStart(date = new Date(), firstDayIndex = ISO_WEEK_FIRST_DAY) {
  const day = startOfDay(date);
  const back = (day.getDay() - firstDayIndex + 7) % 7;
  return addDays(day, -back);
}

/**
 * @returns {{period: string, startDate: string, endDate: string, from: Date, to: Date}|null}
 *   the inclusive calendar days plus the request bounds, or null for a period that
 *   is not a preset range (those come from the snapshot's `periods`).
 */
export function presetRangeWindow(period, now = new Date(), locale = 'en') {
  const name = String(period || '');
  if (!isPresetRangePeriod(name)) return null;
  const today = startOfDay(now);
  // Yesterday is a closed window; the current week always runs up to today.
  const first = name === 'yesterday' ? addDays(today, -1) : weekStart(today, firstDayOfWeekIndex(locale));
  const last = name === 'yesterday' ? first : today;
  return {
    period: name,
    startDate: localDayKey(first),
    endDate: localDayKey(last),
    from: first,
    to: endOfDay(last)
  };
}

/** True while a fetched window still answers the same question it was asked for. */
export function presetRangeWindowMatches(expected, active) {
  if (!expected || !active) return false;
  return active.kind === expected.period
    && active.startDate === expected.startDate
    && active.endDate === expected.endDate;
}
