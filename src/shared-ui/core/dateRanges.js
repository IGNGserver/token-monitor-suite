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

/**
 * The day the 本周 window starts on: ISO 8601 Monday, on every surface and in every
 * locale.
 *
 * This is a *measurement* rule, not a display preference. `Intl.Locale#weekInfo` is
 * absent in the Chromium builds both hosts run on, so a locale-driven lookup could only
 * ever return a fallback here — while a client that *does* have CLDR data (Android,
 * Node) would compute a different span and report a different figure for the same 本周
 * label. One window, one number, so a phone and a browser are comparable. Calendar grids
 * and heatmaps are presentation and may start wherever their locale says; nothing that
 * prints a reported total reads this.
 */
export const SCOPE_WEEK_FIRST_DAY_INDEX = 1;

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
 * The day the scope bar's 本周 window starts on.
 *
 * A function rather than a bare read of [SCOPE_WEEK_FIRST_DAY_INDEX] so the shape stays
 * familiar to call sites, but it takes no locale: the argument was only ever a fallback
 * lookup here, and letting a host's CLDR data move the window would give the same label a
 * different span on a different device.
 */
export function firstDayOfWeekIndex() {
  return SCOPE_WEEK_FIRST_DAY_INDEX;
}

export function weekStart(date = new Date(), firstDayIndex = SCOPE_WEEK_FIRST_DAY_INDEX) {
  const day = startOfDay(date);
  const back = (day.getDay() - firstDayIndex + 7) % 7;
  return addDays(day, -back);
}

/**
 * @returns {{period: string, startDate: string, endDate: string, from: Date, to: Date}|null}
 *   the inclusive calendar days plus the request bounds, or null for a period that
 *   is not a preset range (those come from the snapshot's `periods`).
 */
export function presetRangeWindow(period, now = new Date()) {
  const name = String(period || '');
  if (!isPresetRangePeriod(name)) return null;
  const today = startOfDay(now);
  // Yesterday is a closed window; the current week always runs up to today.
  const first = name === 'yesterday' ? addDays(today, -1) : weekStart(today);
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

/**
 * True when a fetched range answer belongs to the scope tab that is being rendered.
 *
 * A range answer belongs to exactly one selection: the preset that asked for it, or the
 * transient "custom" chip a hand-picked range occupies. Everything else — including the
 * same preset from before midnight — is another tab's number, and rendering it under the
 * current label reports a measurement the user never asked for. This is the predicate the
 * scope chip already uses to pick what to highlight (`rangeKind === 'custom' ? 'custom' :
 * period`), so the highlighted tab and the figure on screen are decided by one rule.
 */
export function isRangeScopeSelection({ period, customRange } = {}) {
  const kind = String(customRange?.kind || '');
  if (!kind) return false;
  if (kind === 'custom') return true;
  return isPresetRangePeriod(kind) && kind === String(period || '');
}

/**
 * Resolve a scope tab to the period it may render.
 *
 * `periods` carries the three windows the collector scans; a preset or picked range is
 * answered by `customPeriod`. When the selection asks for a range the host does not have
 * (loading, failed, or stale after midnight) this returns `null` rather than substituting
 * a snapshot period — the caller renders a loading or retry affordance instead of a
 * number it never obtained.
 */
export function resolveScopePeriod({ period, customRange, customPeriod, periods } = {}) {
  if (customPeriod && isRangeScopeSelection({ period, customRange })) return customPeriod;
  if (isPresetRangePeriod(period)) return null;
  return periods?.[String(period || '')] || null;
}
