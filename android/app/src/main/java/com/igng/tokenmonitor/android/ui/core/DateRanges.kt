package com.igng.tokenmonitor.android.ui.core

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import java.util.Locale

/**
 * Calendar windows for the scope presets that are *not* periods on the wire.
 *
 * Day / month / total ship with every stats snapshot because the collector scans
 * exactly those three windows.  "Yesterday" and "this week" are calendar ranges in the
 * same sense as a hand-picked custom range, so they resolve through
 * `GET /api/usage/range` — the same rule the shared web UI uses
 * (`src/shared-ui/core/dateRanges.js`), which is what keeps the two clients reporting
 * the same number for the same tab.  A port that invents its own week boundary would
 * be a second measurement, not a second rendering of one.
 *
 * Bounds are whole local days and inclusive, matching the endpoint's
 * `startDate` / `endDate` / `startHour` / `endHour` vocabulary: the final day is asked
 * for with `endHour = 23`, which is how the desktop host reads "include that whole
 * hour".  `docs/API.md` notes the totals are day-rounded on the Hub side either way.
 */
object DateRanges {
  /** Presets resolved through the range endpoint rather than the snapshot. */
  val PRESET_RANGE_PERIODS = listOf("yesterday", "week")

  private val ISO_WEEK_FIRST_DAY = DayOfWeek.MONDAY

  /**
   * The day a week starts on, from CLDR via [Locale] rather than assumed.
   *
   * The web fallback is Monday (ISO 8601) because `Intl.Locale#weekInfo` is absent in
   * the Chromium builds both hosts run on; Java's `Locale` *does* carry the data
   * through week-of-year parameters, so the client can be more correct than the
   * browser here.  Where CLDR says Sunday (US and a few others) the client follows the
   * locale, and where the lookup tells us nothing it falls back to Monday, which is
   * the same default the web scope bar uses.
   */
  fun firstDayOfWeek(locale: Locale = Locale.getDefault()): DayOfWeek {
    // `WeekFields` is the CLDR-backed accessor; an unsupported locale still yields
    // the ISO minimum, which is the documented fallback rather than a surprise.
    return runCatching {
      java.time.temporal.WeekFields.of(locale).firstDayOfWeek
    }.getOrDefault(ISO_WEEK_FIRST_DAY)
  }

  fun weekStart(date: LocalDate = LocalDate.now(), locale: Locale = Locale.getDefault()): LocalDate {
    val first = firstDayOfWeek(locale)
    val back = (date.dayOfWeek.value - first.value + 7) % 7
    return date.minusDays(back.toLong())
  }

  /**
   * @return the inclusive calendar window for a preset name, or null when [period] is
   *   not a preset range (those come from the snapshot's `periods`).
   */
  fun presetRangeWindow(
    period: String?,
    today: LocalDate = LocalDate.now(),
    locale: Locale = Locale.getDefault()
  ): PresetRangeWindow? {
    return when (period?.lowercase()) {
      // Yesterday is a closed window; the current week always runs up to today.
      "yesterday" -> PresetRangeWindow(
        period = "yesterday",
        startDate = today.minusDays(1),
        endDate = today.minusDays(1)
      )
      "week" -> PresetRangeWindow(
        period = "week",
        startDate = weekStart(today, locale),
        endDate = today
      )
      else -> null
    }
  }

  fun isPresetRangePeriod(period: String?): Boolean =
    period?.lowercase() in PRESET_RANGE_PERIODS
}

data class PresetRangeWindow(
  val period: String,
  val startDate: LocalDate,
  val endDate: LocalDate
) {
  /** The `startHour` the range endpoint is called with. */
  val startHour: Int get() = 0

  /** The `endHour` the range endpoint is called with — the last hour of the window. */
  val endHour: Int get() = 23

  /** True while a fetched window still answers the same question it was asked for. */
  fun stillMatches(other: PresetRangeWindow?): Boolean =
    other != null && other.period == period &&
      other.startDate == startDate && other.endDate == endDate

  /**
   * Label for the scope chip.  Both ends are printed even when they are the same day:
   * a single date would hide that "yesterday" is a one-day window, which is the fact
   * a user comparing it against "today" needs.
   */
  fun label(now: LocalDate = LocalDate.now()): String {
    val formatter = DateTimeFormatter.ofPattern("MM-dd")
    return if (startDate == endDate) {
      startDate.format(formatter)
    } else {
      "${startDate.format(formatter)} → ${endDate.format(formatter)}"
    }
  }
}
