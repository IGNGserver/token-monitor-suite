package com.igng.tokenmonitor.android.ui.overview

import com.igng.tokenmonitor.android.ui.components.deviceCountsAsOnline
import com.igng.tokenmonitor.android.ui.components.fleetOnlineCount
import com.igng.tokenmonitor.android.ui.components.fleetSorted
import com.igng.tokenmonitor.android.ui.components.FluentIcons
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.draw.shadow
import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.pullToRefresh
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.animation.core.animateFloatAsState
import com.igng.tokenmonitor.android.ui.theme.FluentElevationDefaults
import com.igng.tokenmonitor.android.ui.theme.fluentMotionEnabled
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.igng/tokenmonitor.android.data.model.DeviceDto
import com.igng.tokenmonitor.android.ui.AnalyticsPeriodKind
import com.igng.tokenmonitor.android.ui.HubUiState
import com.igng.tokenmonitor.android.ui.HubViewModel
import com.igng.tokenmonitor.android.ui.PreferencesViewModel
import com.igng.tokenmonitor.android.ui.toPeriodDto
import com.igng.tokenmonitor.android.ui.components.DateTimeRangePickerDialog
import com.igng.tokenmonitor.android.ui.components.UrgentLimitAlertBar
import com.igng.tokenmonitor.android.ui.components.findUrgentLimit
import com.igng.tokenmonitor.android.ui.components.AppCard
import com.igng.tokenmonitor.android.ui.components.CompactMetricCard
import com.igng.tokenmonitor.android.ui.components.ContributionHeatmap
import com.igng.tokenmonitor.android.ui.components.DailyTrendChart
import com.igng.tokenmonitor.android.ui.components.DeviceComparisonChart
import com.igng.tokenmonitor.android.ui.components.DonutChart
import com.igng.tokenmonitor.android.ui.components.EmptyState
import com.igng.tokenmonitor.android.ui.components.FluentPageHeader
import com.igng.tokenmonitor.android.ui.components.FluentStaggeredIn
import com.igng.tokenmonitor.android.ui.components.FluentProgressRing
import com.igng.tokenmonitor.android.ui.components.FluentTabStrip
import com.igng.tokenmonitor.android.ui.components.HeatmapMetric
import com.igng.tokenmonitor.android.ui.components.LimitsSection
import com.igng.tokenmonitor.android.ui.components.MetricHeroCard
import com.igng.tokenmonitor.android.ui.components.OverviewSkeleton
import com.igng.tokenmonitor.android.ui.components.RealtimeStatusChip
import com.igng.tokenmonitor.android.ui.components.SectionHeader
import com.igng.tokenmonitor.android.ui.components.ShareBarList
import com.igng.tokenmonitor.android.ui.components.TrendMetric
import com.igng.tokenmonitor.android.ui.components.TrendRange
import com.igng.tokenmonitor.android.ui.components.countActiveDays
import com.igng.tokenmonitor.android.ui.components.formatTokensShort
import com.igng.tokenmonitor.android.ui.components.takeRange
import com.igng.tokenmonitor.android.ui.components.topShareEntries
import com.igng.tokenmonitor.android.ui.haptics.HapticEvent
import com.igng.tokenmonitor.android.ui.haptics.rememberAppHaptics
import com.igng.tokenmonitor.android.ui.theme.FluentMotion
import com.igng.tokenmonitor.android.ui.theme.FluentShapeDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentSpacingDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentTypeRamp
import com.igng.tokenmonitor.android.ui.theme.LocalFluentColors
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun OverviewScreen(
  state: HubUiState,
  onRefresh: () -> Unit,
  onOpenAnalytics: () -> Unit,
  onOpenDevices: () -> Unit,
  onOpenSettings: () -> Unit,
  onSelectPeriod: (AnalyticsPeriodKind) -> Unit = {},
  onOpenLimits: (() -> Unit)? = null,
  preferencesViewModel: PreferencesViewModel = hiltViewModel(),
  hubViewModel: HubViewModel = hiltViewModel()
) {
  val prefs by preferencesViewModel.preferences.collectAsStateWithLifecycle()
  val colors = LocalFluentColors.current
  val haptics = rememberAppHaptics()
  val refreshState = rememberPullToRefreshState()

  val periods = state.stats?.periods
  val today = periods?.today
  val resolvedPeriod = state.customRangeResult?.toPeriodDto() ?: when (state.analyticsPeriod) {
    AnalyticsPeriodKind.Today -> periods?.today
    AnalyticsPeriodKind.Month -> periods?.month
    AnalyticsPeriodKind.AllTime -> periods?.allTime
    else -> periods?.today
  }
  val activePeriod = resolvedPeriod ?: today
  val customSupported = state.authorization?.capabilities?.usageRange == true
  val periodOptions = if (customSupported) {
    listOf("今日", "昨日", "本周", "本月", "全部", "自定义")
  } else {
    listOf("今日", "本月", "全部")
  }
  val selectedPeriodIndex = when (state.analyticsPeriod) {
    AnalyticsPeriodKind.Today -> 0
    AnalyticsPeriodKind.Yesterday -> 1
    AnalyticsPeriodKind.Week -> 2
    AnalyticsPeriodKind.Month -> if (customSupported) 3 else 1
    AnalyticsPeriodKind.AllTime -> if (customSupported) 4 else 2
    AnalyticsPeriodKind.Custom -> 5
  }
  var showPicker by rememberSaveable { mutableStateOf(false) }

  val clientShares = topShareEntries(
      activePeriod?.clients.orEmpty(),
      activePeriod?.clientCosts.orEmpty(),
      activePeriod?.clientEstimated.orEmpty(),
      activePeriod?.clientCredits.orEmpty(),
      limit = 6
    )
  val modelShares = topShareEntries(activePeriod?.models.orEmpty(), activePeriod?.modelCosts.orEmpty(), limit = 5)
  val devices = fleetSorted(state.devices)
  val activeDevices = devices.filter { deviceCountsAsOnline(it.stale, it.clientStatus) }
  val historySource = state.history ?: state.stats?.historyPreview
  val historyDays = historySource?.daily.orEmpty().takeRange(TrendRange.Days7)
  val historyDailyAll = historySource?.daily.orEmpty()
  val summary = historySource?.summary
  val urgentLimit = remember(state.stats?.limits) { findUrgentLimit(state.stats?.limits) }

  var trendMetricIndex by rememberSaveable { mutableIntStateOf(0) }
  val trendMetric = when (trendMetricIndex) {
    1 -> TrendMetric.Cost
    2 -> TrendMetric.Dual
    else -> TrendMetric.Tokens
  }
  var activeDaysWindow by rememberSaveable { mutableStateOf("all") }
  var heatmapMetric by rememberSaveable { mutableStateOf("cost") }
  val heatMetric = if (heatmapMetric == "tokens") HeatmapMetric.Tokens else HeatmapMetric.Cost
  val displayActiveDays = countActiveDays(historyDailyAll, activeDaysWindow)
  val summaryActiveDays = summary?.activeDays
  val activeDaysValue = if (activeDaysWindow == "year") {
    displayActiveDays.toString()
  } else if (summaryActiveDays != null && summaryActiveDays.isFinite()) {
    summaryActiveDays.toLong().toString()
  } else {
    displayActiveDays.toString()
  }

  // The pull gesture is kept — it is the platform convention for "refresh this
  // screen" and Fluent has no argument against it.  What changed is the disc that
  // answers it: the previous code used `androidx.compose.material.pullrefresh`
  // (Material *2*), which reads `material2.MaterialTheme.colors` — a CompositionLocal
  // this app never provides, because `TokenMonitorTheme` bridges Fluent into
  // Material *3* only.  So the indicator had silently been falling back to Material
  // 2's baseline palette: a white disc with a #6200EE arrow, in both themes.
  Box(
    Modifier
      .fillMaxSize()
      .pullToRefresh(
        isRefreshing = state.isLoading,
        state = refreshState,
        onRefresh = {
          haptics.perform(HapticEvent.Refresh)
          onRefresh()
        }
      )
  ) {
    // Fluent answers the gesture with a ProgressRing on a flyout surface, not
    // Material's circular-arrow disc: `PullToRefreshDefaults.Indicator` is the
    // Material affordance and its shape/colour cannot be retokenised.
    FluentRefreshIndicator(
      state = refreshState,
      refreshing = state.isLoading,
      modifier = Modifier.align(Alignment.TopCenter)
    )
    when {
      state.isLoading && state.stats == null -> OverviewSkeleton()
      state.stats == null && !state.isLoading -> {
        EmptyState(
          title = "暂无数据",
          text = "尚未连接到 Hub 或暂无数据。",
          icon = FluentIcons.LinkDismiss,
          actionLabel = "打开设置",
          onAction = onOpenSettings
        )
      }
      else -> {
        LazyColumn(
          modifier = Modifier.fillMaxSize(),
          contentPadding = PaddingValues(bottom = FluentSpacingDefaults.xxxl),
          verticalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.m)
        ) {
          item {
            FluentPageHeader(
              title = "总览",
              subtitle = "多设备 Token 汇总与健康度",
              trailing = { RealtimeStatusChip(state.realtime) }
            )
          }

          if (urgentLimit != null) {
            item {
              FluentStaggeredIn(index = 0) {
                UrgentLimitAlertBar(
                  provider = urgentLimit.first,
                  remainingPercent = urgentLimit.second,
                  onClick = { onOpenLimits?.invoke() ?: onOpenSettings() },
                  modifier = Modifier.padding(horizontal = FluentSpacingDefaults.l)
                )
              }
            }
          }

          item {
            FluentTabStrip(
              options = periodOptions,
              selectedIndex = selectedPeriodIndex,
              onSelect = { index ->
                haptics.perform(HapticEvent.Selection)
                val kinds = if (customSupported) {
                  listOf(
                    AnalyticsPeriodKind.Today,
                    AnalyticsPeriodKind.Yesterday,
                    AnalyticsPeriodKind.Week,
                    AnalyticsPeriodKind.Month,
                    AnalyticsPeriodKind.AllTime,
                    AnalyticsPeriodKind.Custom
                  )
                } else {
                  listOf(AnalyticsPeriodKind.Today, AnalyticsPeriodKind.Month, AnalyticsPeriodKind.AllTime)
                }
                val kind = kinds.getOrElse(index) { AnalyticsPeriodKind.Today }
                if (kind == AnalyticsPeriodKind.Custom) showPicker = true
                onSelectPeriod(kind)
              },
              contentPadding = FluentSpacingDefaults.l
            )
          }

          item {
            val periodTitle = when (state.analyticsPeriod) {
              AnalyticsPeriodKind.Today -> "今日用量"
              AnalyticsPeriodKind.Yesterday -> "昨日用量"
              AnalyticsPeriodKind.Week -> "本周用量"
              AnalyticsPeriodKind.Month -> "本月用量"
              AnalyticsPeriodKind.AllTime -> "历史全部用量"
              AnalyticsPeriodKind.Custom -> "自定义范围"
            }
            val periodSubtitle = when (state.analyticsPeriod) {
              AnalyticsPeriodKind.Custom -> state.customRange?.label ?: "自定义区间"
              AnalyticsPeriodKind.Week -> state.customRange?.label ?: "本周累计"
              AnalyticsPeriodKind.Yesterday -> state.customRange?.label ?: "昨日"
              else -> null
            }
            FluentStaggeredIn(index = 1) {
              MetricHeroCard(
                title = periodTitle,
                subtitle = periodSubtitle,
                period = activePeriod,
                modifier = Modifier.padding(horizontal = FluentSpacingDefaults.l),
                trailing = if (clientShares.isNotEmpty()) {
                  {
                    DonutChart(
                      entries = clientShares,
                      chartSize = 140.dp,
                      strokeWidth = 16.dp,
                      showLegend = false,
                      centerPrimary = null,
                      centerSecondary = null
                    )
                  }
                } else null
              )
            }
          }

          item {
            FluentStaggeredIn(index = 2) {
              LimitsSection(
                state.stats?.limits,
                maxAccounts = prefs.homeLimitAccountCount,
                modifier = Modifier.padding(horizontal = FluentSpacingDefaults.l)
              )
            }
          }

          item {
            FluentStaggeredIn(index = 3) {
              AppCard(modifier = Modifier.padding(horizontal = FluentSpacingDefaults.l)) {
                Row(
                  Modifier.fillMaxWidth(),
                  horizontalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.s)
                ) {
                  CompactMetricCard(
                    title = "本月",
                    period = periods?.month,
                    modifier = Modifier.weight(1f)
                  )
                  CompactMetricCard(
                    title = "全部",
                    period = periods?.allTime,
                    modifier = Modifier.weight(1f)
                  )
                }
                if (summary != null) {
                  Spacer(Modifier.height(FluentSpacingDefaults.m))
                  Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.s)
                  ) {
                    SummaryStat("活跃天", activeDaysValue, Modifier.weight(1f))
                    SummaryStat("连胜", "${summary.currentStreak.toLong()} 天", Modifier.weight(1f))
                    SummaryStat("峰值日", formatTokensShort(summary.peakDayTokens.toLong()), Modifier.weight(1f))
                  }
                  // The window selector belongs to the figure it changes, so it
                  // lives inside this card rather than floating beneath it.
                  Spacer(Modifier.height(FluentSpacingDefaults.m))
                  FluentTabStrip(
                    options = listOf("全部活跃天", "近一年"),
                    selectedIndex = if (activeDaysWindow == "year") 1 else 0,
                    onSelect = { index ->
                      haptics.perform(HapticEvent.Selection)
                      activeDaysWindow = if (index == 1) "year" else "all"
                    }
                  )
                }
              }
            }
          }

          if (clientShares.isNotEmpty() || modelShares.isNotEmpty()) {
            item {
              FluentStaggeredIn(index = 4) {
                AppCard(modifier = Modifier.padding(horizontal = FluentSpacingDefaults.l)) {
                  SectionHeader(
                    title = "周期构成",
                    subtitle = "客户端与模型",
                    actionLabel = "分析",
                    onAction = onOpenAnalytics
                  )
                  if (clientShares.isNotEmpty()) {
                    Spacer(Modifier.height(FluentSpacingDefaults.m))
                    ShareBarList(clientShares)
                  }
                  if (modelShares.isNotEmpty()) {
                    Spacer(Modifier.height(FluentSpacingDefaults.l))
                    Text(
                      "Top 模型",
                      style = FluentTypeRamp.caption1,
                      fontWeight = FontWeight.SemiBold,
                      color = colors.neutralForeground3
                    )
                    Spacer(Modifier.height(FluentSpacingDefaults.xs))
                    ShareBarList(modelShares, brandClients = false)
                  }
                }
              }
            }
          }

          if (historyDays.isNotEmpty()) {
            item {
              FluentStaggeredIn(index = 5) {
                AppCard(modifier = Modifier.padding(horizontal = FluentSpacingDefaults.l)) {
                  SectionHeader(
                    title = "近 7 日趋势",
                    subtitle = when (trendMetric) {
                      TrendMetric.Cost -> "按日费用"
                      TrendMetric.Dual -> "Token + 费用"
                      else -> "按日 Token 用量"
                    },
                    actionLabel = "分析",
                    onAction = onOpenAnalytics
                  )
                  Spacer(Modifier.height(FluentSpacingDefaults.s))
                  FluentTabStrip(
                    options = listOf("Token", "费用", "对比"),
                    selectedIndex = trendMetricIndex,
                    onSelect = { index ->
                      haptics.perform(HapticEvent.Selection)
                      trendMetricIndex = index
                    }
                  )
                  Spacer(Modifier.height(FluentSpacingDefaults.s))
                  DailyTrendChart(days = historyDays, metric = trendMetric)
                }
              }
            }
          }

          if (historyDailyAll.isNotEmpty()) {
            item {
              FluentStaggeredIn(index = 6) {
                AppCard(modifier = Modifier.padding(horizontal = FluentSpacingDefaults.l)) {
                  SectionHeader(
                    title = "贡献热力图",
                    subtitle = "近 90 天",
                    actionLabel = "分析",
                    onAction = onOpenAnalytics
                  )
                  Spacer(Modifier.height(FluentSpacingDefaults.s))
                  ContributionHeatmap(
                    daily = historyDailyAll,
                    metric = heatMetric,
                    onMetricChange = { next ->
                      haptics.perform(HapticEvent.Selection)
                      heatmapMetric = if (next == HeatmapMetric.Tokens) "tokens" else "cost"
                    }
                  )
                }
              }
            }
          }

          if (activeDevices.isNotEmpty()) {
            item {
              FluentStaggeredIn(index = 7) {
                AppCard(
                  modifier = Modifier.padding(horizontal = FluentSpacingDefaults.l),
                  onClick = onOpenDevices
                ) {
                  SectionHeader(
                    title = "设备对比",
                    subtitle = "${fleetOnlineCount(devices)}/${devices.size} 在线 · 今日 Token",
                    actionLabel = "全部",
                    onAction = onOpenDevices
                  )
                  Spacer(Modifier.height(FluentSpacingDefaults.m))
                  DeviceComparisonChart(devices = activeDevices, limit = 5, showCost = true)
                }
              }
            }
          }
        }
      }
    }
  }

  if (showPicker && customSupported) {
    DateTimeRangePickerDialog(
      onDismiss = { showPicker = false },
      onConfirm = { startDate, endDate, startHour, endHour ->
        showPicker = false
        hubViewModel.loadCustomRange(startDate.toString(), endDate.toString(), startHour, endHour)
      },
      initialStartDate = state.customRange?.startDate?.let { java.time.LocalDate.parse(it) },
      initialEndDate = state.customRange?.endDate?.let { java.time.LocalDate.parse(it) },
      initialStartHour = state.customRange?.startHour,
      initialEndHour = state.customRange?.endHour
    )
  }
}

/**
 * Fluent stat read-out.  A quiet bg2 tile with an uppercase micro-label over the
 * value — the label is deliberately lower-contrast so the number wins.
 */
@Composable
private fun SummaryStat(
  label: String,
  value: String,
  modifier: Modifier = Modifier
) {
  val colors = LocalFluentColors.current
  val tint by animateColorAsState(
    targetValue = colors.neutralLayerInner,
    animationSpec = tween(FluentMotion.normal),
    label = "statTint"
  )
  Column(
    modifier
      .semantics { contentDescription = "$label $value" }
      .clip(FluentShapeDefaults.controlCorner)
      .background(tint)
      .padding(horizontal = FluentSpacingDefaults.xs, vertical = FluentSpacingDefaults.m),
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Text(
      label.uppercase(),
      style = FluentTypeRamp.caption2,
      letterSpacing = 0.5.sp,
      color = colors.neutralForeground3,
      maxLines = 1
    )
    Spacer(Modifier.height(FluentSpacingDefaults.xxs))
    Text(
      value,
      style = FluentTypeRamp.title3,
      color = colors.neutralForeground1,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis
    )
  }
}

/**
 * The refresh affordance that answers [Modifier.pullToRefresh].
 *
 * The gesture itself is Material 3's, and deliberately so: "drag the list down to
 * refresh" is a platform convention Fluent has no competing answer for.  What is
 * ours is everything you can see — a `surfaceFlyout` pill at `level8` with a
 * [FluentProgressRing] inside, sliding on `state.distanceFraction`.  Material's own
 * `Indicator` paints a circular-arrow disc whose shape and colour are not
 * retokenisable, which is the same class of bug that made the old Material 2
 * spinner render a white disc with a #6200EE arrow in dark mode.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FluentRefreshIndicator(
  state: androidx.compose.material3.pulltorefresh.PullToRefreshState,
  refreshing: Boolean,
  modifier: Modifier = Modifier
) {
  val colors = LocalFluentColors.current
  val motion = fluentMotionEnabled()
  // A fixed travel distance rather than Material's positional threshold: the
  // gesture is the library's, the reveal curve is ours.
  val travel = 64.dp
  val revealed = if (motion) state.distanceFraction else 0f
  val offsetY by animateFloatAsState(
    targetValue = if (refreshing) 1f else revealed,
    animationSpec = tween(if (refreshing) FluentMotion.fast else FluentMotion.ultraFast),
    label = "refreshOffset"
  )
  val visible = refreshing || revealed > 0.01f
  Box(
    modifier
      .padding(top = FluentSpacingDefaults.xs)
      .graphicsLayer {
        translationY = (offsetY - 1f) * travel.toPx()
        alpha = if (visible) 1f else 0f
      }
      .width(52.dp)
      .height(28.dp)
      .shadow(FluentElevationDefaults.level8, FluentShapeDefaults.controlCorner, clip = false)
      .clip(FluentShapeDefaults.controlCorner)
      .background(colors.surfaceFlyout)
      .border(0.5.dp, colors.neutralStroke3, FluentShapeDefaults.controlCorner),
    contentAlignment = Alignment.Center
  ) {
    if (visible) {
      FluentProgressRing(size = 18.dp, strokeWidth = 2.dp, color = colors.brandForeground1)
    }
  }
}
