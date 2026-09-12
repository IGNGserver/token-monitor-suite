package com.igng.tokenmonitor.android.ui.components

import com.igng.tokenmonitor.android.data.model.HistoryDayDto
import com.igng.tokenmonitor.android.data.model.LimitProviderDto
import com.igng.tokenmonitor.android.data.local.clampHomeLimitAccountCount
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset

class FormattersHelpersTest {
  @Test
  fun devicePlatformLabelPrefersOsNameAndVersion() {
    assertEquals(
      "Windows 11",
      devicePlatformLabel("win32", "Windows", "11")
    )
    assertEquals(
      "macOS 14.5",
      devicePlatformLabel("darwin", "macOS", "14.5")
    )
    assertEquals(
      "Linux",
      devicePlatformLabel("linux", null, null)
    )
  }

  @Test
  fun countActiveDaysSupportsYearWindow() {
    val today = LocalDate.now(ZoneOffset.UTC)
    val days = listOf(
      HistoryDayDto(date = today.minusDays(10).toString(), tokens = 10.0, cost = 0.1),
      HistoryDayDto(date = today.minusDays(400).toString(), tokens = 20.0, cost = 0.2),
      HistoryDayDto(date = today.minusDays(5).toString(), tokens = 0.0, cost = 0.0)
    )
    assertEquals(2, countActiveDays(days, "all"))
    assertEquals(1, countActiveDays(days, "year"))
  }

  @Test
  fun heatmapValueUsesMetric() {
    val day = HistoryDayDto(date = "2026-07-01", tokens = 100.0, cost = 1.5)
    assertEquals(100.0, heatmapValue(day, "tokens"), 0.001)
    assertEquals(1.5, heatmapValue(day, "cost"), 0.001)
  }

  @Test
  fun historyDailyForHeatmapFillsGaps() {
    val days = listOf(
      HistoryDayDto(date = "2026-07-01", tokens = 1.0, cost = 0.1),
      HistoryDayDto(date = "2026-07-03", tokens = 2.0, cost = 0.2)
    )
    val filled = historyDailyForHeatmap(days, 3)
    assertEquals(3, filled.size)
    assertEquals("2026-07-01", filled[0].date)
    assertEquals("2026-07-02", filled[1].date)
    assertEquals(0.0, filled[1].tokens, 0.001)
    assertEquals("2026-07-03", filled[2].date)
  }

  @Test
  fun agentRuntimeLabelNormalizes() {
    assertEquals("widget", agentRuntimeLabel("electron-widget"))
    assertEquals("headless-agent", agentRuntimeLabel("headless-agent"))
    assertEquals("legacy", agentRuntimeLabel("embedded-hub"))
    assertEquals("", agentRuntimeLabel(null))
  }

  @Test
  fun statusLabelsMapKnownStates() {
    assertEquals("活跃", clientStatusLabel("active"))
    assertEquals("等待", clientStatusLabel("waiting"))
    assertEquals("未发现", clientStatusLabel("missing"))
    assertEquals("未运行", wslStatusLabel("not-running"))
  }

  @Test
  fun formatMoneyAmountIncludesCurrency() {
    assertEquals("12.50 USD", formatMoneyAmount(12.5, "USD"))
    assertEquals("—", formatMoneyAmount(null, "USD"))
  }

  @Test
  fun limitPlanLabelPrefersPlanLabel() {
    val provider = LimitProviderDto(
      provider = "openrouter",
      planLabel = "Credits",
      plan = "legacy",
      accountLabel = "or-main"
    )
    assertEquals("Credits", limitPlanLabel(provider))
  }

  @Test
  fun limitAccountDisplayNameHandlesCodexPersonal() {
    val provider = LimitProviderDto(
      provider = "codex",
      accountEmail = "u@x.com",
      workspaceKind = "personal"
    )
    assertEquals("u@x.com", limitAccountDisplayName(provider))
    val peers = listOf(
      LimitProviderDto(provider = "codex", accountEmail = "u@x.com", accountName = "Work"),
      LimitProviderDto(provider = "codex", accountEmail = "u@x.com", accountName = "Home")
    )
    assertEquals("u@x.com · Work", limitAccountDisplayName(peers[0], peers))
  }


  @Test
  fun limitRemainingToneMatchesDesktopThresholds() {
    assertEquals(LimitRemainingTone.Ok, limitRemainingTone(100.0))
    assertEquals(LimitRemainingTone.Ok, limitRemainingTone(50.0))
    assertEquals(LimitRemainingTone.Warn, limitRemainingTone(49.9))
    assertEquals(LimitRemainingTone.Warn, limitRemainingTone(20.0))
    assertEquals(LimitRemainingTone.Critical, limitRemainingTone(19.9))
    assertEquals(LimitRemainingTone.Unknown, limitRemainingTone(null))
  }

  @Test
  fun clampHomeLimitAccountCountBounds() {
    assertEquals(3, clampHomeLimitAccountCount(3))
    assertEquals(1, clampHomeLimitAccountCount(0))
    assertEquals(12, clampHomeLimitAccountCount(99))
  }
}
