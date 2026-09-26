package com.igng.tokenmonitor.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.igng.tokenmonitor.android.data.model.HistoryDayDto
import com.igng.tokenmonitor.android.data.model.HistoryMonthDto
import com.patrykandpatrick.vico.compose.axis.horizontal.rememberBottomAxis
import com.patrykandpatrick.vico.compose.axis.vertical.rememberStartAxis
import com.patrykandpatrick.vico.compose.chart.Chart
import com.patrykandpatrick.vico.compose.chart.column.columnChart
import com.patrykandpatrick.vico.compose.chart.line.lineChart
import com.patrykandpatrick.vico.compose.chart.scroll.rememberChartScrollSpec
import com.patrykandpatrick.vico.compose.style.ChartStyle
import com.patrykandpatrick.vico.compose.style.ProvideChartStyle
import com.patrykandpatrick.vico.core.axis.AxisItemPlacer
import com.patrykandpatrick.vico.core.chart.line.LineChart
import com.patrykandpatrick.vico.core.component.shape.LineComponent
import com.patrykandpatrick.vico.core.component.shape.Shapes
import com.patrykandpatrick.vico.core.entry.ChartEntryModelProducer
import com.patrykandpatrick.vico.core.entry.entryOf
import com.igng.tokenmonitor.android.ui.theme.FluentChartPalette
import com.igng.tokenmonitor.android.ui.theme.FluentMotion
import com.igng.tokenmonitor.android.ui.theme.FluentShapeDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentSpacingDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentTypeRamp
import com.igng.tokenmonitor.android.ui.theme.LocalFluentColors
import kotlin.math.max

enum class TrendMetric { Tokens, Cost, ActiveTime, Dual }
enum class TrendRange { Days7, Days30, Months12 }

fun List<HistoryDayDto>.takeRange(range: TrendRange): List<HistoryDayDto> {
  val sorted = sortedBy { it.date }
  return when (range) {
    TrendRange.Days7 -> sorted.takeLast(7)
    TrendRange.Days30 -> sorted.takeLast(30)
    TrendRange.Months12 -> sorted.takeLast(30)
  }
}

fun List<HistoryMonthDto>.takeMonths(limit: Int = 12): List<HistoryMonthDto> =
  sortedBy { it.month }.takeLast(limit)

// ─── Fluent 2 chart series colours ──────────────────────────────────────────
//
// Series identity comes from the app's accent plus two fixed hues from the
// accessible chart palette.  The previous version kept a private brightened
// hex per theme; that duplicated what the Fluent aliases already solve, and it
// meant a brand-seed change left the charts on Microsoft blue.

@Composable
private fun seriesColor(metric: TrendMetric): Color {
  val colors = LocalFluentColors.current
  return when (metric) {
    TrendMetric.Cost -> FluentChartPalette[1]
    TrendMetric.ActiveTime -> FluentChartPalette[2]
    else -> colors.brandForeground1
  }
}

@Composable
private fun DailyTrendChartInner(
  days: List<HistoryDayDto>,
  metric: TrendMetric,
  modifier: Modifier,
  useLine: Boolean
) {
  val colors = LocalFluentColors.current
  val values = days.map {
    when (metric) {
      TrendMetric.Cost -> it.cost.toFloat()
      TrendMetric.ActiveTime -> (it.activeTimeMs / 3_600_000.0).toFloat()
      else -> it.tokens.toFloat()
    }
  }
  val labels = days.map { shortDayLabel(it.date) }
  val color = seriesColor(metric)
  val colorArgb = color.toArgb()
  val modelProducer = remember(days, metric) {
    ChartEntryModelProducer(listOf(values.mapIndexed { index, v -> entryOf(index.toFloat(), v) }))
  }
  val labelStep = max(1, days.size / 6)
  val peak = values.maxOrNull() ?: 0f
  val peakIndex = values.indexOfFirst { it == peak }.takeIf { it >= 0 } ?: 0
  val peakLabel = labels.getOrNull(peakIndex)

  ProvideChartStyle(fluentChartStyle(color)) {
    val column = columnChart(
      columns = listOf(
        LineComponent(
          color = colorArgb,
          thicknessDp = if (days.size > 14) 6f else 10f,
          // Fluent columns are squared, not pill-rounded; a small fractional
          // radius keeps them from looking clipped at narrow widths.
          shape = Shapes.roundedCornerShape(allPercent = 12)
        )
      )
    )
    val line = lineChart(
      lines = listOf(
        LineChart.LineSpec(
          lineColor = colorArgb,
          lineThicknessDp = 2f
        )
      )
    )
    Chart(
      chart = if (useLine) line else column,
      chartModelProducer = modelProducer,
      startAxis = rememberStartAxis(
        valueFormatter = { value, _ -> formatAxis(metric, value) },
        itemPlacer = remember { AxisItemPlacer.Vertical.default(maxItemCount = 4) }
      ),
      bottomAxis = rememberBottomAxis(
        valueFormatter = { value, _ ->
          val idx = value.toInt().coerceIn(0, labels.lastIndex)
          labels[idx]
        },
        itemPlacer = remember(labelStep) {
          AxisItemPlacer.Horizontal.default(spacing = labelStep, addExtremeLabelPadding = true)
        }
      ),
      modifier = modifier
        .fillMaxWidth()
        .height(210.dp),
      chartScrollSpec = rememberChartScrollSpec(isScrollEnabled = days.size > 14)
    )
  }
  if (peak > 0f) {
    Spacer(Modifier.height(FluentSpacingDefaults.xs))
    Text(
      buildString {
        append("峰值 ")
        append(formatAxis(metric, peak))
        if (!peakLabel.isNullOrBlank()) {
          append(" · ")
          append(peakLabel)
        }
      },
      style = FluentTypeRamp.caption2,
      color = colors.neutralForeground3
    )
  }
}

@Composable
fun DailyTrendChart(
  days: List<HistoryDayDto>,
  metric: TrendMetric,
  modifier: Modifier = Modifier,
  useLine: Boolean = false
) {
  if (days.isEmpty()) return
  when (metric) {
    TrendMetric.Dual -> DualMetricDailyChart(days, modifier)
    TrendMetric.ActiveTime -> SingleMetricDailyChart(days, TrendMetric.ActiveTime, modifier, useLine = true)
    else -> SingleMetricDailyChart(days, metric, modifier, useLine)
  }
}

@Composable
private fun SingleMetricDailyChart(
  days: List<HistoryDayDto>,
  metric: TrendMetric,
  modifier: Modifier,
  useLine: Boolean
) {
  DailyTrendChartInner(days, metric, modifier, useLine)
}

/** Dual metric: stacked single-axis charts (clearer than dual-axis scale tricks). */
@Composable
fun DualMetricDailyChart(
  days: List<HistoryDayDto>,
  modifier: Modifier = Modifier
) {
  val colors = LocalFluentColors.current
  Column(modifier.fillMaxWidth()) {
    Text(
      "Token",
      style = FluentTypeRamp.caption1,
      fontWeight = FontWeight.SemiBold,
      color = colors.neutralForeground2
    )
    Spacer(Modifier.height(FluentSpacingDefaults.xs))
    SingleMetricDailyChart(days, TrendMetric.Tokens, Modifier, useLine = false)
    Spacer(Modifier.height(FluentSpacingDefaults.m))
    Text(
      "费用",
      style = FluentTypeRamp.caption1,
      fontWeight = FontWeight.SemiBold,
      color = colors.neutralForeground2
    )
    Spacer(Modifier.height(FluentSpacingDefaults.xs))
    SingleMetricDailyChart(days, TrendMetric.Cost, Modifier, useLine = true)
  }
}

@Composable
fun ActiveTimeDailyChart(
  days: List<HistoryDayDto>,
  modifier: Modifier = Modifier,
  useLine: Boolean = true
) {
  SingleMetricDailyChart(days, TrendMetric.ActiveTime, modifier, useLine)
}

@Composable
fun MonthlyTrendChart(
  months: List<HistoryMonthDto>,
  metric: TrendMetric,
  modifier: Modifier = Modifier
) {
  val colors = LocalFluentColors.current
  if (months.isEmpty()) return
  if (metric == TrendMetric.Dual) {
    Column(modifier.fillMaxWidth()) {
      Text(
        "Token",
        style = FluentTypeRamp.caption1,
        fontWeight = FontWeight.SemiBold,
        color = colors.neutralForeground2
      )
      Spacer(Modifier.height(FluentSpacingDefaults.xs))
      MonthlySingle(months, TrendMetric.Tokens, Modifier)
      Spacer(Modifier.height(FluentSpacingDefaults.m))
      Text(
        "费用",
        style = FluentTypeRamp.caption1,
        fontWeight = FontWeight.SemiBold,
        color = colors.neutralForeground2
      )
      Spacer(Modifier.height(FluentSpacingDefaults.xs))
      MonthlySingle(months, TrendMetric.Cost, Modifier)
    }
    return
  }
  MonthlySingle(months, metric, modifier)
}

@Composable
private fun MonthlySingle(
  months: List<HistoryMonthDto>,
  metric: TrendMetric,
  modifier: Modifier
) {
  val colors = LocalFluentColors.current
  val values = months.map {
    when (metric) {
      TrendMetric.Cost -> it.cost.toFloat()
      TrendMetric.ActiveTime -> (it.activeTimeMs / 3_600_000.0).toFloat()
      else -> it.tokens.toFloat()
    }
  }
  val labels = months.map { shortMonthLabel(it.month) }
  val color = seriesColor(metric)
  val colorArgb = color.toArgb()
  val modelProducer = remember(months, metric) {
    ChartEntryModelProducer(listOf(values.mapIndexed { index, v -> entryOf(index.toFloat(), v) }))
  }
  val peak = values.maxOrNull() ?: 0f
  val peakIndex = values.indexOfFirst { it == peak }.takeIf { it >= 0 } ?: 0
  val peakLabel = labels.getOrNull(peakIndex)

  ProvideChartStyle(fluentChartStyle(color)) {
    Chart(
      chart = columnChart(
        columns = listOf(
          LineComponent(
            color = colorArgb,
            thicknessDp = 14f,
            shape = Shapes.roundedCornerShape(allPercent = 10)
          )
        )
      ),
      chartModelProducer = modelProducer,
      startAxis = rememberStartAxis(
        valueFormatter = { value, _ -> formatAxis(metric, value) },
        itemPlacer = remember { AxisItemPlacer.Vertical.default(maxItemCount = 4) }
      ),
      bottomAxis = rememberBottomAxis(
        valueFormatter = { value, _ ->
          val idx = value.toInt().coerceIn(0, labels.lastIndex)
          labels[idx]
        }
      ),
      modifier = modifier
        .fillMaxWidth()
        .height(200.dp)
    )
  }
  if (peak > 0f) {
    Spacer(Modifier.height(FluentSpacingDefaults.xs))
    Text(
      buildString {
        append("峰值 ")
        append(formatAxis(metric, peak))
        if (!peakLabel.isNullOrBlank()) {
          append(" · ")
          append(peakLabel)
        }
      },
      style = FluentTypeRamp.caption2,
      color = colors.neutralForeground3
    )
  }
}

private fun formatAxis(metric: TrendMetric, value: Float): String {
  return when (metric) {
    TrendMetric.Cost -> formatUsd(value.toDouble(), compact = true)
    TrendMetric.ActiveTime -> formatActiveHours(value.toDouble())
    else -> formatTokensShort(value.toLong())
  }
}

fun formatActiveHours(hours: Double): String {
  return when {
    hours >= 10 -> String.format(java.util.Locale.US, "%.0fh", hours)
    hours >= 1 -> String.format(java.util.Locale.US, "%.1fh", hours)
    hours > 0 -> String.format(java.util.Locale.US, "%.0fm", hours * 60)
    else -> "0"
  }
}

fun formatActiveTimeMs(ms: Double): String {
  if (ms <= 0) return "0"
  return formatActiveHours(ms / 3_600_000.0)
}

private fun shortDayLabel(date: String): String {
  val parts = date.split("-")
  return if (parts.size >= 3) "${parts[1].toInt()}/${parts[2].toInt()}" else date.takeLast(5)
}

private fun shortMonthLabel(month: String): String {
  val parts = month.split("-")
  return if (parts.size >= 2) "${parts[0].takeLast(2)}/${parts[1]}" else month
}

enum class TrendStackMode { Client, Model }

@Composable
fun StackedDailyTrendChart(
  days: List<HistoryDayDto>,
  stackMode: TrendStackMode,
  modifier: Modifier = Modifier,
  maxKeys: Int = 6
) {
  val colors = LocalFluentColors.current
  if (days.isEmpty()) return
  val hasBreakdown = days.any {
    if (stackMode == TrendStackMode.Model) it.perModel.isNotEmpty() else it.perClient.isNotEmpty()
  }
  if (!hasBreakdown) {
    Text(
      "完整历史尚未包含 client/model 堆叠（将回退到总量趋势）。连接 Hub 后会自动拉取 /api/history。",
      style = FluentTypeRamp.caption1,
      color = colors.neutralForeground3,
      modifier = modifier
    )
    return
  }

  val totals = linkedMapOf<String, Double>()
  for (day in days) {
    val map = if (stackMode == TrendStackMode.Model) day.perModel else day.perClient
    for ((key, value) in map) {
      totals[key] = (totals[key] ?: 0.0) + value.tokens
    }
  }
  val topKeys = totals.entries.sortedByDescending { it.value }.take(maxKeys).map { it.key }
  if (topKeys.isEmpty()) return
  val stackPalette = FluentChartPalette
  val colorMap = topKeys.mapIndexed { index, key -> key to stackPalette[index % stackPalette.size] }.toMap()
  val maxTotal = days.maxOf { day ->
    val map = if (stackMode == TrendStackMode.Model) day.perModel else day.perClient
    topKeys.sumOf { key -> map[key]?.tokens ?: 0.0 }.coerceAtLeast(day.tokens)
  }.coerceAtLeast(1.0)
  val grow = animateGrowProgress(
    resetKey = "${stackMode}:${days.size}:${topKeys.joinToString(",")}",
    durationMillis = FluentMotion.slower
  )

  Column(
    modifier = modifier.fillMaxWidth(),
    verticalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.m)
  ) {
    Text(
      if (stackMode == TrendStackMode.Model) "按模型堆叠" else "按客户端堆叠",
      style = FluentTypeRamp.title3,
      color = colors.neutralForeground1
    )
    Canvas(
      modifier = Modifier
        .fillMaxWidth()
        .height(160.dp)
    ) {
      val barCount = days.size.coerceAtLeast(1)
      val slot = size.width / barCount
      val barW = (slot * 0.62f).coerceAtLeast(2f)
      // Fluent stacks with a 1px separator per boundary so segment counts stay
      // readable without a legend lookup.
      val gap = if (topKeys.size > 1) 1f else 0f
      days.forEachIndexed { index, day ->
        val map = if (stackMode == TrendStackMode.Model) day.perModel else day.perClient
        var y = size.height
        val x = index * slot + (slot - barW) / 2f
        for (key in topKeys) {
          val tokens = map[key]?.tokens ?: 0.0
          if (tokens <= 0.0) continue
          val h = (((tokens / maxTotal) * size.height).toFloat() * grow - gap)
            .coerceAtLeast(0f)
          if (h <= 0f) continue
          y -= h + gap
          drawRoundRect(
            color = colorMap.getValue(key),
            topLeft = Offset(x, y),
            size = Size(barW, h),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(1.5f, 1.5f)
          )
        }
      }
    }
    Column(verticalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.xs)) {
      topKeys.forEach { key ->
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.s)
        ) {
          Box(
            Modifier
              .size(10.dp)
              .clip(FluentShapeDefaults.smallCorner)
              .background(colorMap.getValue(key))
          )
          Text(
            key,
            style = FluentTypeRamp.caption1,
            color = colors.neutralForeground1,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
          )
          Text(
            formatCompact(totals[key] ?: 0.0),
            style = FluentTypeRamp.caption1,
            color = colors.neutralForeground3
          )
        }
      }
    }
  }
}

private fun formatCompact(value: Double): String {
  val n = value
  return when {
    n >= 1_000_000_000 -> String.format("%.1fB", n / 1_000_000_000.0)
    n >= 1_000_000 -> String.format("%.1fM", n / 1_000_000.0)
    n >= 1_000 -> String.format("%.1fK", n / 1_000.0)
    else -> n.toLong().toString()
  }
}

/**
 * Vico style for the trend charts, from Fluent tokens.
 *
 * This used to be `m3ChartStyle`, i.e. the chart was styled by Material 3's own
 * chart palette adapter.  Under the theme bridge its *colours* happened to come out
 * Fluent, which is exactly the case the migration brief warns about: a Material
 * component reading bridged tokens still applies Material's defaults for everything
 * the bridge does not name (guide-line dashing, axis text role, mark radius), so the
 * chart looked close-but-not-equal to every other surface and could not be reasoned
 * about from `Color.kt`.
 */
/**
 * The trend-chart style, built from Fluent aliases.
 *
 * This used to be `m3ChartStyle(entityColors = …)`: Material 3's adapter, which reads
 * `MaterialTheme.colorScheme` and applies Material's own choices for everything the
 * Fluent bridge does not name — axis-label role, guide-line weight, mark corner
 * treatment.  Under the bridge its *colours* happened to come out Fluent, which is
 * precisely the failure mode the migration is meant to remove: a Material consumer
 * that looks right today and drifts the day someone touches the bridge.
 *
 * `ChartStyle.fromColors` is Vico's palette-level entry point, so each colour a chart
 * can paint is now named from `Color.kt` instead of arriving through Material.
 */
@Composable
internal fun fluentChartStyle(color: androidx.compose.ui.graphics.Color): ChartStyle {
  val colors = LocalFluentColors.current
  return ChartStyle.fromColors(
    axisGuidelineColor = colors.neutralStroke3,
    axisLabelColor = colors.neutralForeground3,
    axisLineColor = colors.neutralStroke2,
    entityColors = listOf(color),
    elevationOverlayColor = Color.Transparent
  )
}
