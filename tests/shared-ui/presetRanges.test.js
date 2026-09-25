'use strict';

// The calendar presets are computed in the browser and answered by the range API,
// so their date math is the whole feature: a window that is off by one day, or an
// upper bound that leaks the next day's first hour into the total, is a wrong number
// on screen rather than a visible crash.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  PRESET_RANGE_PERIODS,
  firstDayOfWeekIndex,
  isPresetRangePeriod,
  localDayKey,
  presetRangeWindow,
  presetRangeWindowMatches,
  weekStart
} = require('../../src/shared-ui/core/dateRanges.js');
const { MESSAGE_KEYS, SUPPORTED_LOCALES } = require('../../src/shared-ui/core/i18n.js');

const REPO_ROOT = path.join(__dirname, '..', '..');

function at(year, month, day, hour = 9) {
  return new Date(year, month - 1, day, hour, 20, 0, 0);
}

function clockOf(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    + `:${String(date.getSeconds()).padStart(2, '0')}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

test('yesterday is the single day before today, whatever the clock reads', () => {
  const range = presetRangeWindow('yesterday', at(2026, 9, 26, 23), 'en');
  assert.equal(range.startDate, '2026-09-25');
  assert.equal(range.endDate, '2026-09-25');
  assert.equal(localDayKey(range.from), '2026-09-25');
  assert.equal(clockOf(range.from), '00:00:00.000');
  assert.equal(clockOf(range.to), '23:59:59.999');
});

test('a preset window ends at the last millisecond of the day', () => {
  // The desktop hosts read the `to` bound as "include that whole hour", so
  // midnight-to-midnight would add the following day's first hour to the total.
  // The Hub rounds to calendar days either way, so both hosts agree on this bound.
  for (const period of PRESET_RANGE_PERIODS) {
    const range = presetRangeWindow(period, at(2026, 9, 26), 'zh-CN');
    assert.equal(clockOf(range.to), '23:59:59.999', `${period} upper bound`);
  }
});

test('yesterday crosses month and year boundaries', () => {
  assert.equal(presetRangeWindow('yesterday', at(2026, 3, 1), 'en').startDate, '2026-02-28');
  assert.equal(presetRangeWindow('yesterday', at(2026, 1, 1), 'en').startDate, '2025-12-31');
});

test('this week runs from the locale week start through today', () => {
  for (const locale of ['', 'en', 'zh-CN', 'de', 'not a locale tag!!']) {
    const firstDay = firstDayOfWeekIndex(locale);
    for (const day of [at(2026, 9, 21), at(2026, 9, 23), at(2026, 10, 1), at(2026, 1, 1)]) {
      const range = presetRangeWindow('week', day, locale);
      assert.equal(range.endDate, localDayKey(day), `${locale}: a week never reaches the future`);
      assert.equal(range.from.getDay(), firstDay, `${locale}: starts on the locale week start`);
      assert.ok(range.from <= day && day.getTime() - range.from.getTime() < 7 * 86_400_000,
        `${locale}: stays inside seven days`);
    }
  }
});

test('weekStart walks back to the requested weekday', () => {
  // Monday-first: Wednesday 2026-09-23 started on Monday the 21st.
  assert.equal(localDayKey(weekStart(at(2026, 9, 23), 1)), '2026-09-21');
  // Sunday-first, and crossing a month boundary: Thursday 2026-10-01 started on 9-27.
  assert.equal(localDayKey(weekStart(at(2026, 10, 1), 0)), '2026-09-27');
  // On the week's own first day the window is that single day.
  assert.equal(localDayKey(weekStart(at(2026, 9, 21), 1)), '2026-09-21');
});

test('a malformed locale falls back to the ISO week start', () => {
  assert.equal(firstDayOfWeekIndex('not a locale tag!!'), 1);
  assert.equal(firstDayOfWeekIndex(undefined), firstDayOfWeekIndex('en'));
});

test('only the calendar presets resolve through the range API', () => {
  for (const period of ['today', 'month', 'allTime', '', 'nope']) {
    assert.equal(presetRangeWindow(period, at(2026, 9, 26), 'en'), null, period);
    assert.equal(isPresetRangePeriod(period), false, period);
  }
  assert.deepEqual([...PRESET_RANGE_PERIODS], ['yesterday', 'week']);
});

test('a fetched window stops matching once the day rolls over', () => {
  const asked = presetRangeWindow('week', at(2026, 9, 23), 'en');
  const fetched = {
    kind: asked.period,
    startDate: asked.startDate,
    endDate: asked.endDate
  };
  assert.equal(presetRangeWindowMatches(asked, fetched), true);
  assert.equal(presetRangeWindowMatches(asked, null), false);
  assert.equal(presetRangeWindowMatches(asked, { ...fetched, kind: 'yesterday' }), false);
  // The next day extends the week, so the cached numbers are no longer the answer.
  const nextDay = presetRangeWindow('week', at(2026, 9, 24), 'en');
  assert.equal(presetRangeWindowMatches(nextDay, fetched), false);
  assert.equal(presetRangeWindowMatches(nextDay, { ...fetched, endDate: nextDay.endDate }), true);
});

test('every scope tab the app can render has a label in every locale', () => {
  const appSource = fs.readFileSync(path.join(REPO_ROOT, 'src', 'shared-ui', 'app.js'), 'utf8');
  const tabs = appSource.match(/const PERIOD_TABS = \[([^\]]+)\]/);
  assert.ok(tabs, 'app.js should declare the scope tab order');
  const ids = tabs[1].split(',').map((entry) => entry.trim().replace(/'/g, '')).filter(Boolean);
  assert.deepEqual(ids, ['today', 'yesterday', 'week', 'month', 'allTime']);
  for (const locale of SUPPORTED_LOCALES) {
    for (const id of ids) {
      assert.ok(
        MESSAGE_KEYS[locale].includes(`period.${id}`),
        `period.${id} is missing from ${locale}`
      );
    }
  }
});
