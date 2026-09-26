package com.igng.tokenmonitor.android.ui

import com.igng.tokenmonitor.android.data.model.HistoryDayDto
import com.igng.tokenmonitor.android.data.model.SubscriptionDto
import com.igng.tokenmonitor.android.ui.components.heatmapWeekdayLabels
import com.igng.tokenmonitor.android.ui.components.topShareEntries
import com.igng.tokenmonitor.android.ui.core.DateRanges
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.DayOfWeek
import java.time.LocalDate
import java.util.Locale

/**
 * The pure logic the Fluent 2 client migration added.
 *
 * JVM-only on purpose: the Android test runner in this module cannot load the Compose
 * runtime (see the note in `DisplayFx.kt`), so every helper exercised here is kept free
 * of Compose types, and the ones that render are asserted by the Node guards instead.
 */
class ScopeAndProvenanceTest {
  private val monday = LocalDate.of(2026, 9, 21) // a Monday
  private val wednesday = LocalDate.of(2026, 9, 23)

  @Test
  fun yesterdayIsAClosedOneDayWindow() {
    val window = DateRanges.presetRangeWindow("yesterday", monday, Locale.UK)!!
    assertEquals(monday.minusDays(1), window.startDate)
    assertEquals(monday.minusDays(1), window.endDate)
    // Day boundaries are inclusive end-to-start so a preset and a hand-picked range
    // over the same days cannot answer with different totals.
    assertEquals(0, window.startHour)
    assertEquals(23, window.endHour)
  }

  @Test
  fun weekRunsUpToTodayAndStartsOnTheLocalesFirstDay() {
    val week = DateRanges.presetRangeWindow("week", wednesday, Locale.UK)!!
    assertEquals(wednesday, week.endDate)
    assertEquals(DayOfWeek.MONDAY, DateRanges.firstDayOfWeek(Locale.UK))
    // A Wednesday inside a Monday-start week sits two days in.
    assertEquals(wednesday.minusDays(2), week.startDate)

    val sundayStart = DateRanges.presetRangeWindow("week", wednesday, Locale.US)!!
    assertEquals(DayOfWeek.SUNDAY, DateRanges.firstDayOfWeek(Locale.US))
    assertEquals(wednesday.minusDays(3), sundayStart.startDate)
  }

  @Test
  fun aWindowStopsMatchingWhenTheDateRollsOver() {
    val morning = DateRanges.presetRangeWindow("week", monday, Locale.UK)!!
    assertTrue(morning.stillMatches(morning))
    val nextDay = DateRanges.presetRangeWindow("week", monday.plusDays(1), Locale.UK)!!
    assertTrue(
      "the fetched window must be re-resolved after midnight, not kept",
      !morning.stillMatches(nextDay)
    )
    assertNull(DateRanges.presetRangeWindow("today", monday, Locale.UK))
    assertNull(DateRanges.presetRangeWindow("month", monday, Locale.UK))
  }

  @Test
  fun creditsOnlyClientsStillProduceAShareRow() {
    // Qoder reports credits and zero tokens.  Ranking on tokens alone used to drop the
    // row entirely, which rendered as "Qoder used nothing".
    val entries = topShareEntries(
      tokens = mapOf("claude" to 500L, "qoder" to 0L),
      costs = mapOf("claude" to 1.0),
      estimated = mapOf("claude" to true),
      credits = mapOf("qoder" to 42.0),
      limit = 6
    )
    assertEquals(2, entries.size)
    val qoder = entries.first { it.key == "qoder" }
    assertEquals(42.0, qoder.credits!!, 0.0001)
    assertTrue(qoder.creditsOnly)
    assertTrue(entries.first { it.key == "claude" }.estimated)
  }

  @Test
  fun anAggregatedTailIsNeverPresentedAsExact() {
    val entries = topShareEntries(
      tokens = (1..8).associate { "client$it" to (100L - it) },
      estimated = mapOf("client8" to true),
      limit = 4
    )
    val other = entries.last()
    assertEquals("其他", other.key)
    assertTrue(
      "one estimated member makes the summed row estimated — OR semantics, as docs/API.md states",
      other.estimated
    )
  }

  @Test
  fun subscriptionMonthlyEquivalentKeepsTopupsUnamortised() {
    val monthly = com.igng.tokenmonitor.android.ui.more.monthlyEquivalent(
      listOf(
        SubscriptionDto(id = "a", plan = "pro", amount = 120.0, currency = "USD", interval = "year"),
        SubscriptionDto(id = "b", plan = "max", amount = 20.0, currency = "USD", interval = "month"),
        SubscriptionDto(id = "c", plan = "topup", amount = 5.0, currency = "USD", recordType = "topup")
      )
    )
    // 120/12 + 20 + 5.  The top-up is spent this month and is not divided by anything.
    assertEquals(35.0, monthly["USD"]!!, 0.0001)
  }

  @Test
  fun intervalCountStretchesModulelyEquivalence() {
    val monthly = com.igng.tokenmonitor.android.ui.more.monthlyEquivalent(
      listOf(
        SubscriptionDto(id = "q", amount = 30.0, currency = "CNY", interval = "month", intervalCount = 3)
      )
    )
    assertEquals(10.0, monthly["CNY"]!!, 0.0001)
  }

  @Test
  fun heatmapRowLabelsFollowTheWeekStart() {
    // Rows 1/3/5 of a Sunday-first grid are Tue/Thu/Sat; of a Monday-first grid they
    // are Wed/Fri/Sun.  The old constant claimed "一 三 五" for a Sunday-first grid,
    // which labelled every row with the wrong day.
    // Sun-first: row 0 is Sunday, so rows 1/3/5 are Mon/Wed/Fri.
    val sundayFirst = heatmapWeekdayLabels(DayOfWeek.SUNDAY)
    assertEquals("一", sundayFirst[1])
    assertEquals("三", sundayFirst[3])
    assertEquals("五", sundayFirst[5])
    // Mon-first: the same row numbers shift by one day.
    val mondayFirst = heatmapWeekdayLabels(DayOfWeek.MONDAY)
    assertEquals("二", mondayFirst[1])
    assertEquals("四", mondayFirst[3])
    assertEquals("六", mondayFirst[5])
  }

  @Test
  fun historyDayRowsStillCarryTheZeroFilledGapContract() {
    // Regression guard: the heatmap relies on contiguous days, so a helper that stops
    // filling gaps would silently shift every column.
    val days = listOf(
      HistoryDayDto(date = "2026-09-20", tokens = 5.0),
      HistoryDayDto(date = "2026-09-23", tokens = 7.0)
    )
    val filled = com.igng.tokenmonitor.android.ui.components.historyDailyForHeatmap(days, 4)
    assertEquals(4, filled.size)
    // Contiguity is the contract: the two reported days are kept and the two missing
    // ones become explicit zeros, so a column cannot drift out of its weekday row.
    assertEquals("2026-09-20", filled.first().date)
    assertEquals(5.0, filled.first().tokens, 0.0001)
    assertEquals("2026-09-23", filled.last().date)
    assertEquals(7.0, filled.last().tokens, 0.0001)
    assertEquals(0.0, filled[1].tokens, 0.0001)
    assertEquals(0.0, filled[2].tokens, 0.0001)
  }
}
