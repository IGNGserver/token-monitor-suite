package com.igng.tokenmonitor.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.igng.tokenmonitor.android.data.model.HistoryDayDto
import com.igng.tokenmonitor.android.ui.theme.FluentShapeDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentSpacingDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentTypeRamp
import com.igng.tokenmonitor.android.ui.theme.LocalFluentColors
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZoneOffset
import kotlin.math.ceil
import kotlin.math.max

enum class HeatmapMetric { Tokens, Cost }

fun heatmapValue(day: HistoryDayDto, metric: HeatmapMetric): Double =
  when (metric) {
    HeatmapMetric.Cost -> max(0.0, day.cost)
    HeatmapMetric.Tokens -> max(0.0, day.tokens)
  }

fun historyDailyForHeatmap(daily: List<HistoryDayDto>, days: Int = 90): List<HistoryDayDto> {
  if (daily.isEmpty() || days <= 0) return emptyList()
  val byDate = daily.associateBy { it.date }
  val end = daily.mapNotNull {
    runCatching { LocalDate.parse(it.date) }.getOrNull()
  }.maxOrNull() ?: LocalDate.now(ZoneOffset.UTC)
  val start = end.minusDays((days - 1).toLong())
  return generateSequence(start) { current ->
    val next = current.plusDays(1)
    if (next.isAfter(end)) null else next
  }.map { date ->
    val key = date.toString()
    byDate[key] ?: HistoryDayDto(date = key)
  }.toList()
}

private fun heatLevel(value: Double, maxValue: Double): Int {
  if (value <= 0.0 || maxValue <= 0.0) return 0
  val ratio = value / maxValue
  return when {
    ratio < 0.25 -> 1
    ratio < 0.5 -> 2
    ratio < 0.75 -> 3
    else -> 4
  }
}

/** The four non-zero steps of the ramp; step 0 is the neutral "no usage" slot. */
private val HeatmapAlphaSteps = listOf(0.18f, 0.38f, 0.62f, 0.92f)

/**
 * Which weekday each labelled row draws.
 *
 * The grid used to be pinned Sunday-first with a matching `{1:一, 3:三, 5:五}` label
 * constant, and those two were consistent with each other — the label was never the
 * bug.  What was wrong is the pinning: the same nine weeks read differently when the
 * week is made to start on Monday, and the columns silently disagreed with the 本周
 * preset and the date picker's grid, both of which follow the locale.  So the row→label
 * map is now *derived* from the same week-start value instead of being a constant that
 * has to be kept in step by hand.
 */
/** Row index -> the Chinese weekday initial that row actually draws. */
internal fun heatmapWeekdayLabels(firstDayOfWeek: DayOfWeek): Map<Int, String> {
  val initials = "日一二三四五六"
  return listOf(1, 3, 5).associateWith { row ->
    val day = DayOfWeek.of(((firstDayOfWeek.value - 1 + row) % 7) + 1)
    initials[day.value % 7].toString()
  }
}

// ─── Fluent 2 contribution heatmap ──────────────────────────────────────────
//
// Fluent data-visualisation rules applied here:
//   • cells are square and share ONE hue ramp (brand for tokens, the semantic
//     warning hue for cost), so the series reads as intensity, not as category;
//   • both hues are theme-resolved aliases rather than literal hexes, which is
//     what keeps the low steps perceptible in dark mode;
//   • the gutter sits on the 4 dp grid (2 dp between 12 dp cells) and cell
//     corners use `smallCorner` — Fluent never pill-rounds a data mark;
//   • the empty step is the "cut-out" surface plus a hairline, so a zero day is
//     still a visible slot instead of a hole in the grid;
//   • the grid is announceable: one merged content description carries the
//     window, the active-day count and the peak, and today is ringed with
//     `neutralStroke1` (a structural ring — status colour is never borrowed).

@Composable
fun ContributionHeatmap(
  daily: List<HistoryDayDto>,
  metric: HeatmapMetric,
  modifier: Modifier = Modifier,
  dayCount: Int = 90,
  onMetricChange: ((HeatmapMetric) -> Unit)? = null
) {
  val colors = LocalFluentColors.current
  val days = remember(daily, dayCount) { historyDailyForHeatmap(daily, dayCount) }
  val values = remember(days, metric) { days.map { heatmapValue(it, metric) } }
  val maxValue = remember(values) { max(1.0, values.maxOrNull() ?: 1.0) }
  val active = values.count { it > 0.0 }

  val seriesHue = if (metric == HeatmapMetric.Cost) colors.warningForeground else colors.brandForeground1
  val levelColors = remember(seriesHue, colors.neutralForeground3) {
    listOf(colors.neutralForeground3.copy(alpha = 0.10f)) + HeatmapAlphaSteps.map { seriesHue.copy(alpha = it) }
  }
  val cell = FluentSpacingDefaults.m
  val gap = FluentSpacingDefaults.xxs
  val labelStyle = FluentTypeRamp.caption2
  val labelColor = colors.neutralForeground3

  // The week starts where the user's calendar says it does.  This is a *grid*, so it
  // follows CLDR via `DateRanges.firstDayOfWeek` — the 本周 scope window deliberately
  // does not (it is ISO Monday on every surface, see `SCOPE_WEEK_FIRST_DAY`), because a
  // row label is presentation while a window total is a reported figure.  `% 7` converts
  // Mon=1…Sun=7 to Sun=0…Sat=6.
  val weekFirst = com.igng.tokenmonitor.android.ui.core.DateRanges.firstDayOfWeek()
  val startDow = remember(days, weekFirst) {
    days.firstOrNull()?.date?.let { raw ->
      runCatching {
        val first = LocalDate.parse(raw).dayOfWeek
        (((first.value - weekFirst.value) % 7) + 7) % 7
      }.getOrDefault(0)
    } ?: 0
  }
  val weeks = if (days.isEmpty()) 0 else ceil((days.size + startDow) / 7.0).toInt()
  val rowLabels = remember(weekFirst) { heatmapWeekdayLabels(weekFirst) }

  // Week bucketing is unchanged from the canvas layout: day i sits at
  // (i + startDow), its column is pos / 7 and its row is pos % 7.  A -1 slot is
  // an empty cell, so the first column keeps its leading offset.
  val grid = remember(days, startDow, weeks) {
    if (weeks == 0) {
      emptyList()
    } else {
      val slots = IntArray(weeks * 7) { -1 }
      days.indices.forEach { index -> slots[index + startDow] = index }
      List(weeks) { week -> List(7) { offset -> slots[week * 7 + offset] } }
    }
  }

  // A month is labelled once, on the first week that contains its 1st..7th.
  val monthLabels = remember(days, startDow, weeks) {
    if (weeks == 0) {
      emptyList()
    } else {
      val monthOfWeek = IntArray(weeks)
      days.forEachIndexed { index, day ->
        val month = runCatching { LocalDate.parse(day.date).monthValue }.getOrNull()
        if (month != null) {
          val week = (index + startDow) / 7
          if (monthOfWeek[week] == 0) monthOfWeek[week] = month
        }
      }
      var previous = 0
      monthOfWeek.map { month ->
        if (month == 0 || month == previous) null else month.also { previous = it }
      }
    }
  }

  val todayKey = remember { LocalDate.now(ZoneOffset.UTC).toString() }
  val metricName = if (metric == HeatmapMetric.Cost) "按费用" else "按 Token"
  val peakIndex = values.indexOf(values.maxOrNull() ?: 0.0)
  val peakLabel = if (peakIndex >= 0) {
    val peak = values[peakIndex]
    if (metric == HeatmapMetric.Cost) formatUsd(peak) else formatTokensShort(peak.toLong())
  } else {
    "—"
  }
  val scroll = rememberScrollState()

  Column(modifier = modifier.fillMaxWidth()) {
    if (onMetricChange != null) {
      val options = remember {
        listOf(HeatmapMetric.Tokens to "Token", HeatmapMetric.Cost to "费用")
      }
      FluentTabStrip(
        options = options.map { it.second },
        selectedIndex = options.indexOfFirst { it.first == metric },
        onSelect = { index -> onMetricChange(options[index].first) }
      )
      Spacer(Modifier.height(FluentSpacingDefaults.s))
    }

    if (days.isEmpty()) {
      Text(
        "暂无历史热力图数据",
        style = FluentTypeRamp.caption1,
        color = colors.neutralForeground2,
        modifier = Modifier.padding(horizontal = FluentSpacingDefaults.l)
      )
    } else {
      Row(
        Modifier
          .fillMaxWidth()
          .horizontalScroll(scroll)
      ) {
        // Month row + weekday gutter share the cell pitch so both stay aligned.
        val slotWidth = cell + gap
        Column {
          Spacer(Modifier.height(FluentSpacingDefaults.l))
          Column(
            modifier = Modifier.width(FluentSpacingDefaults.xl),
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(gap)
          ) {
            for (dow in 0..6) {
              val label = rowLabels[dow]
              if (label == null) Spacer(Modifier.height(cell)) else Text(
                label,
                style = labelStyle,
                color = labelColor,
                maxLines = 1,
                modifier = Modifier.height(cell)
              )
            }
          }
        }
        Spacer(Modifier.width(gap))
        Column {
          Row(Modifier.height(FluentSpacingDefaults.l)) {
            monthLabels.forEach { label ->
              Box(Modifier.width(slotWidth)) {
                if (label != null) {
                  Text("${label}月", style = labelStyle, color = labelColor, maxLines = 1)
                }
              }
            }
          }
          Row(
            modifier = Modifier.semantics(mergeDescendants = true) {
              contentDescription = buildString {
                append("贡献热力图，近 ").append(days.size).append(" 天，")
                append(active).append(" 天有用量，").append(metricName)
                append("峰值 ").append(peakLabel)
                if (peakIndex >= 0) {
                  append("（").append(days[peakIndex].date).append("）")
                }
                append("。")
              }
            },
            horizontalArrangement = Arrangement.spacedBy(gap)
          ) {
            grid.forEach { week ->
              Column(verticalArrangement = Arrangement.spacedBy(gap)) {
                week.forEach { slot ->
                  if (slot < 0) {
                    Spacer(Modifier.size(cell))
                  } else {
                    val day = days[slot]
                    val level = heatLevel(values[slot], maxValue)
                    HeatmapCell(
                      fill = levelColors[level],
                      level = level,
                      isToday = day.date == todayKey,
                      size = cell
                    )
                  }
                }
              }
            }
          }
        }
      }

      Spacer(Modifier.height(FluentSpacingDefaults.s))
      Row(
        Modifier
          .fillMaxWidth()
          .padding(end = FluentSpacingDefaults.xs),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(
          "近 ${days.size} 天 · $active 天有用量 · $metricName",
          style = FluentTypeRamp.caption1,
          color = colors.neutralForeground2,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
          modifier = Modifier.weight(1f)
        )
        Spacer(Modifier.width(FluentSpacingDefaults.s))
        HeatmapRampLegend(levelColors = levelColors, cell = cell, gap = gap, textColor = labelColor)
      }
    }
  }
}

/** A single day mark: an alpha step of the series hue, plus its structural ring. */
@Composable
private fun HeatmapCell(fill: Color, level: Int, isToday: Boolean, size: Dp) {
  val colors = LocalFluentColors.current
  val shape = FluentShapeDefaults.smallCorner
  val base = Modifier
    .size(size)
    .background(fill, shape)
  Box(
    when {
      // `neutralStroke1` reads as "this axis", never as an alert.
      isToday -> base.border(1.dp, colors.neutralStroke1, shape)
      // The lowest step must stay perceptible against the container.
      level == 0 -> base.border(0.5.dp, colors.neutralStroke3, shape)
      else -> base
    }
  )
}

/** Ramp key: five swatches at the mark geometry, low → high. */
@Composable
private fun HeatmapRampLegend(
  levelColors: List<Color>,
  cell: Dp,
  gap: Dp,
  textColor: Color
) {
  Row(verticalAlignment = Alignment.CenterVertically) {
    Text("少", style = FluentTypeRamp.caption2, color = textColor, maxLines = 1)
    Spacer(Modifier.width(gap))
    levelColors.forEach { fill ->
      Box(
        Modifier
          .padding(end = gap)
          .size(cell)
          .background(fill, FluentShapeDefaults.smallCorner)
      )
    }
    Text("多", style = FluentTypeRamp.caption2, color = textColor, maxLines = 1)
  }
}
