package com.igng.tokenmonitor.android.ui.overview

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
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LinkOff
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.igng.tokenmonitor.android.data.model.DeviceDto
import com.igng.tokenmonitor.android.ui.HubUiState
import com.igng.tokenmonitor.android.ui.components.AppCard
import com.igng.tokenmonitor.android.ui.components.countActiveDays
import com.igng.tokenmonitor.android.ui.components.HeatmapMetric
import com.igng.tokenmonitor.android.ui.components.ContributionHeatmap
import com.igng.tokenmonitor.android.ui.components.CompactMetricCard
import com.igng.tokenmonitor.android.ui.components.DailyTrendChart
import com.igng.tokenmonitor.android.ui.components.DeviceComparisonChart
import com.igng.tokenmonitor.android.ui.components.DonutChart
import com.igng.tokenmonitor.android.ui.components.EmptyState
import com.igng.tokenmonitor.android.ui.components.LimitsSection
import com.igng.tokenmonitor.android.ui.components.MetricHeroCard
import com.igng.tokenmonitor.android.ui.components.OverviewSkeleton
import com.igng.tokenmonitor.android.ui.components.RealtimeStatusChip
import com.igng.tokenmonitor.android.ui.components.SectionHeader
import com.igng.tokenmonitor.android.ui.components.ShareBarList
import com.igng.tokenmonitor.android.ui.components.StatusDot
import com.igng.tokenmonitor.android.ui.components.TrendMetric
import com.igng.tokenmonitor.android.ui.components.TrendRange
import com.igng.tokenmonitor.android.ui.components.formatTokensShort
import com.igng.tokenmonitor.android.ui.components.formatUsd
import com.igng.tokenmonitor.android.ui.components.takeRange
import com.igng.tokenmonitor.android.ui.components.topShareEntries
import com.igng.tokenmonitor.android.ui.PreferencesViewModel
import com.igng.tokenmonitor.android.ui.haptics.HapticEvent
import com.igng.tokenmonitor.android.ui.haptics.rememberAppHaptics

@OptIn(ExperimentalMaterialApi::class)
@Composable
fun OverviewScreen(
  state: HubUiState,
  onRefresh: () -> Unit,
  onOpenAnalytics: () -> Unit,
  onOpenDevices: () -> Unit,
  onOpenSettings: () -> Unit,
  preferencesViewModel: PreferencesViewModel = hiltViewModel()
) {
  val prefs by preferencesViewModel.preferences.collectAsStateWithLifecycle()
  val haptics = rememberAppHaptics()
  val refreshState = rememberPullRefreshState(refreshing = state.isLoading, onRefresh = {
    haptics.perform(HapticEvent.Refresh)
    onRefresh()
  })
  val periods = state.stats?.periods
  val today = periods?.today
  val clientShares = topShareEntries(today?.clients.orEmpty(), today?.clientCosts.orEmpty(), limit = 6)
  val modelShares = topShareEntries(today?.models.orEmpty(), today?.modelCosts.orEmpty(), limit = 5)
  val devices = state.devices.sortedWith(
    compareBy<DeviceDto> { it.stale }.thenByDescending { it.periods.today.totalTokens }
  )
  val activeDevices = devices.filterNot { it.stale }
  val historySource = state.history ?: state.stats?.historyPreview
  val historyDays = historySource?.daily.orEmpty().takeRange(TrendRange.Days7)
  val summary = historySource?.summary
  var trendMetricIndex by rememberSaveable { mutableIntStateOf(0) }
  val trendMetric = when (trendMetricIndex) {
    1 -> TrendMetric.Cost
    2 -> TrendMetric.Dual
    else -> TrendMetric.Tokens
  }
  var activeDaysWindow by rememberSaveable { mutableStateOf("all") }
  var heatmapMetric by rememberSaveable { mutableStateOf("cost") }
  val heatMetric = if (heatmapMetric == "tokens") HeatmapMetric.Tokens else HeatmapMetric.Cost
  val historyDailyAll = historySource?.daily.orEmpty()
  val displayActiveDays = countActiveDays(historyDailyAll, activeDaysWindow)
  val summaryActiveDays = summary?.activeDays
  val activeDaysValue = if (activeDaysWindow == "year") {
    displayActiveDays.toString()
  } else if (summaryActiveDays != null && summaryActiveDays.isFinite()) {
    summaryActiveDays.toLong().toString()
  } else {
    displayActiveDays.toString()
  }

  Box(
    Modifier
      .fillMaxSize()
      .pullRefresh(refreshState)
  ) {
    when {
      state.isLoading && state.stats == null -> OverviewSkeleton()
      state.stats == null && !state.isLoading -> {
        EmptyState(
          title = "暂无数据",
          text = "尚未连接到 Hub 或暂无数据。",
          icon = Icons.Outlined.LinkOff,
          actionLabel = "打开设置",
          onAction = onOpenSettings
        )
      }
      else -> {
        LazyColumn(
          modifier = Modifier.fillMaxSize(),
          contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
          verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
          // —— Screen 1: Hero + status + 7d trend ——
          item {
            Row(
              Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically
            ) {
              Column {
                Text("今日用量", style = MaterialTheme.typography.headlineSmall)
                Text(
                  "多设备 Token 汇总",
                  style = MaterialTheme.typography.bodySmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant
                )
              }
              RealtimeStatusChip(state.realtime)
            }
          }

          item {
            MetricHeroCard(
              title = "今日",
              period = today,
              trailing = if (clientShares.isNotEmpty()) {
                {
                  DonutChart(
                    entries = clientShares,
                    chartSize = 140.dp,
                    strokeWidth = 18.dp,
                    showLegend = false,
                    centerPrimary = null,
                    centerSecondary = null
                  )
                }
              } else null
            )
          }

          item {
            Row(
              Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.spacedBy(8.dp)
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
          }

          if (summary != null) {
            item {
              Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
              ) {
                SummaryChip("活跃天", activeDaysValue, Modifier.weight(1f))
                SummaryChip("连胜", "${summary.currentStreak.toLong()} 天", Modifier.weight(1f))
                SummaryChip("峰值日", formatTokensShort(summary.peakDayTokens.toLong()), Modifier.weight(1f))
              }
            }
          }

          item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              listOf("all" to "全部活跃天", "year" to "近一年").forEach { (key, label) ->
                FilterChip(
                  selected = activeDaysWindow == key,
                  onClick = {
                    haptics.perform(HapticEvent.Selection)
                    activeDaysWindow = key
                  },
                  label = { Text(label) }
                )
              }
            }
          }

          if (historyDailyAll.isNotEmpty()) {
            item {
              AppCard {
                SectionHeader(
                  title = "贡献热力图",
                  subtitle = "近 90 天",
                  actionLabel = "分析",
                  onAction = onOpenAnalytics
                )
                Spacer(Modifier.height(8.dp))
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

          if (historyDays.isNotEmpty()) {
            item {
              AppCard {
                SectionHeader(
                  title = "近 7 日趋势",
                  subtitle = when (trendMetric) {
                    TrendMetric.Cost -> "按日费用"
                    TrendMetric.Dual -> "Token + 费用"
                    else -> "按日 Token 用量"
                  },
                  actionLabel = "更多",
                  onAction = onOpenAnalytics
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                  listOf("Token", "费用", "对比").forEachIndexed { index, label ->
                    FilterChip(
                      selected = trendMetricIndex == index,
                      onClick = { haptics.perform(HapticEvent.Selection); trendMetricIndex = index },
                      label = { Text(label) }
                    )
                  }
                }
                Spacer(Modifier.height(12.dp))
                DailyTrendChart(days = historyDays, metric = trendMetric)
              }
            }
          }

          // —— Screen 2: limits ——
          item { LimitsSection(state.stats?.limits, maxAccounts = prefs.homeLimitAccountCount) }

          // —— Screen 3: share + devices ——
          if (clientShares.isNotEmpty()) {
            item {
              AppCard {
                SectionHeader(
                  title = "客户端占比",
                  subtitle = "今日用量",
                  actionLabel = "分析",
                  onAction = onOpenAnalytics
                )
                Spacer(Modifier.height(12.dp))
                ShareBarList(clientShares)
              }
            }
          }

          if (modelShares.isNotEmpty()) {
            item {
              AppCard {
                SectionHeader(
                  title = "Top 模型",
                  subtitle = "今日 token 排名",
                  actionLabel = "全部",
                  onAction = onOpenAnalytics
                )
                Spacer(Modifier.height(12.dp))
                ShareBarList(modelShares, brandClients = false)
              }
            }
          }

          if (devices.isNotEmpty()) {
            item {
              AppCard {
                SectionHeader(
                  title = "设备对比",
                  subtitle = "${devices.count { !it.stale }}/${devices.size} 在线 · 今日 Token",
                  actionLabel = "全部",
                  onAction = onOpenDevices
                )
                Spacer(Modifier.height(12.dp))
                DeviceComparisonChart(devices = activeDevices, limit = 5, showCost = true)
              }
            }
          }
        }
      }
    }
    PullRefreshIndicator(
      refreshing = state.isLoading,
      state = refreshState,
      modifier = Modifier.align(Alignment.TopCenter)
    )
  }
}
@Composable
private fun SummaryChip(
  label: String,
  value: String,
  modifier: Modifier = Modifier
) {
  Surface(
    modifier = modifier,
    shape = MaterialTheme.shapes.medium,
    color = MaterialTheme.colorScheme.surfaceContainerHigh
  ) {
    Column(
      Modifier
        .fillMaxWidth()
        .padding(horizontal = 8.dp, vertical = 12.dp),
      horizontalAlignment = Alignment.CenterHorizontally
    ) {
      Text(
        label,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
      Spacer(Modifier.height(2.dp))
      Text(
        value,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.SemiBold,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
    }
  }
}
