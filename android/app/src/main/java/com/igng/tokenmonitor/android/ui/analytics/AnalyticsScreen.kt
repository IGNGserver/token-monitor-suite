package com.igng.tokenmonitor.android.ui.analytics

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.outlined.PieChartOutline
import androidx.compose.material.icons.outlined.Timeline
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.igng.tokenmonitor.android.data.model.PeriodDto
import com.igng.tokenmonitor.android.data.model.StatsDto
import com.igng.tokenmonitor.android.ui.AnalyticsPeriodKind
import com.igng.tokenmonitor.android.ui.HubUiState
import com.igng.tokenmonitor.android.ui.HubViewModel
import com.igng.tokenmonitor.android.ui.components.AppCard
import com.igng.tokenmonitor.android.ui.components.countActiveDays
import com.igng.tokenmonitor.android.ui.components.HeatmapMetric
import com.igng.tokenmonitor.android.ui.components.ContributionHeatmap
import com.igng.tokenmonitor.android.ui.components.ClientBranding
import com.igng.tokenmonitor.android.ui.components.ClientMonogram
import com.igng.tokenmonitor.android.ui.components.DailyTrendChart
import com.igng.tokenmonitor.android.ui.components.StackedDailyTrendChart
import com.igng.tokenmonitor.android.ui.components.TrendStackMode
import com.igng.tokenmonitor.android.ui.components.DateTimeRangePickerDialog
import com.igng.tokenmonitor.android.ui.components.DonutChart
import com.igng.tokenmonitor.android.ui.components.EmptyState
import com.igng.tokenmonitor.android.ui.components.LimitsSection
import com.igng.tokenmonitor.android.ui.components.MonthlyTrendChart
import com.igng.tokenmonitor.android.ui.components.ShareBarList
import com.igng.tokenmonitor.android.ui.components.ShareEntry
import com.igng.tokenmonitor.android.ui.components.TrendMetric
import com.igng.tokenmonitor.android.ui.components.TrendRange
import com.igng.tokenmonitor.android.ui.components.formatTokensShort
import com.igng.tokenmonitor.android.ui.components.formatUsd
import com.igng.tokenmonitor.android.ui.components.takeMonths
import com.igng.tokenmonitor.android.ui.components.takeRange
import com.igng.tokenmonitor.android.ui.components.topShareEntries
import com.igng.tokenmonitor.android.ui.haptics.HapticEvent
import com.igng.tokenmonitor.android.ui.haptics.rememberAppHaptics
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsScreen(
  state: HubUiState,
  viewModel: HubViewModel,
  navController: NavHostController
) {
  var tabIndex by rememberSaveable { mutableIntStateOf(0) }
  val tabLabels = listOf("客户端", "模型", "趋势")
  val haptics = rememberAppHaptics()

  Column(Modifier.fillMaxSize()) {
    Column(
      Modifier
        .fillMaxWidth()
        .padding(horizontal = 16.dp, vertical = 8.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      Text("分析", style = MaterialTheme.typography.headlineSmall)
      PrimaryTabRow(selectedTabIndex = tabIndex) {
        tabLabels.forEachIndexed { index, label ->
          Tab(
            selected = tabIndex == index,
            onClick = { haptics.perform(HapticEvent.Selection); tabIndex = index },
            text = { Text(label) }
          )
        }
      }
    }

    when (tabIndex) {
      0 -> ShareAnalyticsTab(
        state = state,
        viewModel = viewModel,
        clients = true,
        onOpenDetail = { id ->
          navController.navigate("client/${encode(id)}")
        }
      )
      1 -> ShareAnalyticsTab(
        state = state,
        viewModel = viewModel,
        clients = false,
        onOpenDetail = { id ->
          navController.navigate("model/${encode(id)}")
        }
      )
      else -> TrendAnalyticsTab(state, onEnsureHistory = { viewModel.refreshHistory() })
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShareAnalyticsTab(
  state: HubUiState,
  viewModel: HubViewModel,
  clients: Boolean,
  onOpenDetail: (String) -> Unit
) {
  val haptics = rememberAppHaptics()
  var showPicker by rememberSaveable { mutableStateOf(false) }
  val customSupported = state.authorization?.capabilities?.usageRange == true
  val periodLabels = if (customSupported) listOf("今日", "本月", "全部", "自定义") else listOf("今日", "本月", "全部")
  val selectedIndex = when (state.analyticsPeriod) {
    AnalyticsPeriodKind.Today -> 0
    AnalyticsPeriodKind.Month -> 1
    AnalyticsPeriodKind.AllTime -> 2
    AnalyticsPeriodKind.Custom -> if (customSupported) 3 else 0
  }
  val period: PeriodDto? = when (state.analyticsPeriod) {
    AnalyticsPeriodKind.Today -> state.stats?.periods?.today
    AnalyticsPeriodKind.Month -> state.stats?.periods?.month
    AnalyticsPeriodKind.AllTime -> state.stats?.periods?.allTime
    AnalyticsPeriodKind.Custom -> state.customRangeResult?.let {
      PeriodDto(
        totalTokens = it.totalTokens,
        costUsd = it.costUsd,
        clients = it.clients,
        clientCosts = it.clientCosts,
        models = it.models,
        modelCosts = it.modelCosts,
        projects = it.projects,
        sessions = it.sessions
      )
    }
  }
  val shares = if (clients) {
    topShareEntries(period?.clients.orEmpty(), period?.clientCosts.orEmpty(), limit = 8)
  } else {
    topShareEntries(period?.models.orEmpty(), period?.modelCosts.orEmpty(), limit = 8)
  }
  val emptyText = when {
    state.analyticsPeriod == AnalyticsPeriodKind.Custom && state.customRangeLoading -> "正在加载自定义范围…"
    state.analyticsPeriod == AnalyticsPeriodKind.Custom && state.customRange == null -> "点「自定义」选择起止时间。"
    clients -> "这个周期没有客户端用量。"
    else -> "这个周期没有模型用量。"
  }

  Column(Modifier.fillMaxSize()) {
    SingleChoiceSegmentedButtonRow(
      Modifier
        .fillMaxWidth()
        .padding(horizontal = 16.dp)
    ) {
      periodLabels.forEachIndexed { index, label ->
        SegmentedButton(
          selected = selectedIndex == index,
          onClick = {
            haptics.perform(HapticEvent.Selection)
            when (index) {
              0 -> viewModel.setAnalyticsPeriod(AnalyticsPeriodKind.Today)
              1 -> viewModel.setAnalyticsPeriod(AnalyticsPeriodKind.Month)
              2 -> viewModel.setAnalyticsPeriod(AnalyticsPeriodKind.AllTime)
              else -> {
                viewModel.setAnalyticsPeriod(AnalyticsPeriodKind.Custom)
                showPicker = true
              }
            }
          },
          shape = SegmentedButtonDefaults.itemShape(index, periodLabels.size),
          label = { Text(label) }
        )
      }
    }

    if (state.analyticsPeriod == AnalyticsPeriodKind.Custom) {
      Row(
        Modifier
          .fillMaxWidth()
          .padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(
          state.customRange?.label ?: "未选择范围",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          modifier = Modifier.weight(1f)
        )
        TextButton(onClick = { showPicker = true }) { Text("调整") }
      }
      state.customRangeResult?.source?.takeIf { it.isNotBlank() }?.let { source ->
        Text(
          when (source) {
            "usage_events" -> "数据来源：事件账本（小时精度）"
            "history_daily" -> "数据来源：每日历史（天精度回退）"
            else -> "数据来源：$source"
          },
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          modifier = Modifier.padding(horizontal = 16.dp)
        )
      }
    }

    Spacer(Modifier.height(8.dp))

    when {
      state.analyticsPeriod == AnalyticsPeriodKind.Custom && state.customRangeLoading -> {
        Column(
          Modifier.fillMaxSize(),
          verticalArrangement = Arrangement.Center,
          horizontalAlignment = Alignment.CenterHorizontally
        ) {
          CircularProgressIndicator()
          Spacer(Modifier.height(12.dp))
          Text("加载自定义范围…", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      shares.isEmpty() -> EmptyState(title = "暂无图表", text = emptyText, icon = Icons.Outlined.PieChartOutline)
      else -> {
        LazyColumn(
          modifier = Modifier.fillMaxSize(),
          contentPadding = PaddingValues(16.dp),
          verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
          item {
            AppCard {
              Text(
                if (clients) "客户端份额" else "模型份额",
                style = MaterialTheme.typography.titleMedium
              )
              Text(
                "${formatTokensShort(period?.totalTokens ?: 0L)} · ${formatUsd(period?.costUsd ?: 0.0)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
              Spacer(Modifier.height(12.dp))
              DonutChart(
                entries = shares,
                centerPrimary = formatTokensShort(period?.totalTokens ?: 0L),
                centerSecondary = formatUsd(period?.costUsd ?: 0.0, compact = true)
              )
            }
          }
          item {
            AppCard {
              Text("明细 · 点击查看详情", style = MaterialTheme.typography.titleMedium)
              Spacer(Modifier.height(12.dp))
              ShareBarList(
                shares,
                brandClients = clients,
                onEntryClick = { entry ->
                  haptics.perform(HapticEvent.Tap)
                  onOpenDetail(entry.key)
                }
              )
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
        viewModel.loadCustomRange(startDate.toString(), endDate.toString(), startHour, endHour)
      },
      initialStartDate = state.customRange?.startDate?.let { java.time.LocalDate.parse(it) },
      initialEndDate = state.customRange?.endDate?.let { java.time.LocalDate.parse(it) },
      initialStartHour = state.customRange?.startHour,
      initialEndHour = state.customRange?.endHour
    )
  }
}


private fun modelsFromSessions(period: PeriodDto?, clientId: String?): Pair<Map<String, Long>, Map<String, Double>> {
  val tokens = linkedMapOf<String, Long>()
  val costs = linkedMapOf<String, Double>()
  val sessions = period?.sessions.orEmpty().values
  for (session in sessions) {
    if (clientId != null && session.client != clientId) continue
    val sessionCost = session.costUsd
    val models = session.models
    if (models.isEmpty()) continue
    val modelTotal = models.values.sum().coerceAtLeast(1L)
    for ((model, modelTokens) in models) {
      val t = modelTokens.coerceAtLeast(0L)
      tokens[model] = (tokens[model] ?: 0L) + t
      val share = t.toDouble() / modelTotal.toDouble()
      costs[model] = (costs[model] ?: 0.0) + sessionCost * share
    }
  }
  return tokens to costs
}

private fun clientsFromSessions(period: PeriodDto?, modelId: String): Pair<Map<String, Long>, Map<String, Double>> {
  val tokens = linkedMapOf<String, Long>()
  val costs = linkedMapOf<String, Double>()
  for (session in period?.sessions.orEmpty().values) {
    val modelTokens = session.models[modelId] ?: continue
    val client = session.client?.takeIf { it.isNotBlank() } ?: "unknown"
    tokens[client] = (tokens[client] ?: 0L) + modelTokens.coerceAtLeast(0L)
    val modelTotal = session.models.values.sum().coerceAtLeast(1L)
    val share = modelTokens.toDouble() / modelTotal.toDouble()
    costs[client] = (costs[client] ?: 0.0) + session.costUsd * share
  }
  return tokens to costs
}

@Composable
fun ClientDetailScreen(
  clientId: String,
  state: HubUiState,
  onBack: () -> Unit,
  onHome: (() -> Unit)? = null
) {
  val periodLabel = periodCaption(state)
  val period = resolvePeriod(state)
  val tokens = period?.clients?.get(clientId) ?: 0L
  val cost = period?.clientCosts?.get(clientId) ?: 0.0
  val (modelTokens, modelCosts) = when (state.analyticsPeriod) {
    AnalyticsPeriodKind.Custom -> {
      val range = state.customRangeResult
      (range?.clientModels?.get(clientId).orEmpty()) to (range?.clientModelCosts?.get(clientId).orEmpty())
    }
    else -> {
      val mapped = period?.clientModels?.get(clientId).orEmpty()
      if (mapped.isNotEmpty()) {
        mapped to period?.clientModelCosts?.get(clientId).orEmpty()
      } else {
        modelsFromSessions(period, clientId)
      }
    }
  }
  val shares = topShareEntries(modelTokens, modelCosts, limit = 12)
  val title = ClientBranding.label(clientId)

  DetailScaffold(
    title = title,
    subtitle = periodLabel,
    onBack = onBack,
    heroTokens = tokens,
    heroCost = cost,
    leading = { ClientMonogram(clientId, size = 36.dp) },
    emptyText = "该客户端在此范围内没有模型拆分。",
    shares = shares,
    brandClients = false,
    onHome = onHome
  )
}

@Composable
fun ModelDetailScreen(
  modelId: String,
  state: HubUiState,
  onBack: () -> Unit,
  onHome: (() -> Unit)? = null
) {
  val periodLabel = periodCaption(state)
  val period = resolvePeriod(state)
  val tokens = period?.models?.get(modelId) ?: 0L
  val cost = period?.modelCosts?.get(modelId) ?: 0.0
  val (clientTokens, clientCosts) = when (state.analyticsPeriod) {
    AnalyticsPeriodKind.Custom -> {
      val range = state.customRangeResult
      val t = linkedMapOf<String, Long>()
      val c = linkedMapOf<String, Double>()
      range?.clientModels?.forEach { (client, models) ->
        val value = models[modelId] ?: return@forEach
        t[client] = value
        c[client] = range.clientModelCosts[client]?.get(modelId) ?: 0.0
      }
      t to c
    }
    else -> clientsFromSessions(period, modelId)
  }
  val shares = topShareEntries(clientTokens, clientCosts, limit = 12)

  DetailScaffold(
    title = modelId,
    subtitle = periodLabel,
    onBack = onBack,
    heroTokens = tokens,
    heroCost = cost,
    leading = null,
    emptyText = "该模型在此范围内没有客户端拆分。",
    shares = shares,
    brandClients = true,
    onHome = onHome
  )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailScaffold(
  title: String,
  subtitle: String,
  onBack: () -> Unit,
  heroTokens: Long,
  heroCost: Double,
  leading: (@Composable () -> Unit)?,
  emptyText: String,
  shares: List<ShareEntry>,
  brandClients: Boolean,
  onHome: (() -> Unit)? = null
) {
  Column(Modifier.fillMaxSize()) {
    TopAppBar(
      title = { Text(title) },
      navigationIcon = {
        IconButton(onClick = onBack) {
          Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
        }
      },
      actions = {
        if (onHome != null) {
          IconButton(onClick = onHome) {
            Icon(Icons.Filled.Home, contentDescription = "首页")
          }
        }
      }
    )
    LazyColumn(
      contentPadding = PaddingValues(16.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
      item {
        AppCard {
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            leading?.invoke()
            Column {
              Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
              Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
          }
          Spacer(Modifier.height(12.dp))
          Text(formatTokensShort(heroTokens), style = MaterialTheme.typography.headlineSmall)
          Text(formatUsd(heroCost), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      item {
        AppCard {
          Text(if (brandClients) "客户端拆分" else "模型拆分", style = MaterialTheme.typography.titleMedium)
          Spacer(Modifier.height(12.dp))
          if (shares.isEmpty()) {
            Text(emptyText, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          } else {
            ShareBarList(entries = shares, brandClients = brandClients)
            if (shares.size >= 2) {
              Spacer(Modifier.height(16.dp))
              DonutChart(
                entries = shares,
                centerPrimary = formatTokensShort(shares.sumOf { it.tokens }),
                centerSecondary = formatUsd(shares.fold(0.0) { acc, e -> acc + e.costUsd }, compact = true)
              )
            }
          }
        }
      }
    }
  }
}

private fun resolvePeriod(state: HubUiState): PeriodDto? = when (state.analyticsPeriod) {
  AnalyticsPeriodKind.Today -> state.stats?.periods?.today
  AnalyticsPeriodKind.Month -> state.stats?.periods?.month
  AnalyticsPeriodKind.AllTime -> state.stats?.periods?.allTime
  AnalyticsPeriodKind.Custom -> state.customRangeResult?.let {
    PeriodDto(
      totalTokens = it.totalTokens,
      costUsd = it.costUsd,
      clients = it.clients,
      clientCosts = it.clientCosts,
      models = it.models,
      modelCosts = it.modelCosts,
      clientModels = it.clientModels,
      clientModelCosts = it.clientModelCosts,
      projects = it.projects,
      sessions = it.sessions
    )
  }
}

private fun periodCaption(state: HubUiState): String = when (state.analyticsPeriod) {
  AnalyticsPeriodKind.Today -> "周期：今日"
  AnalyticsPeriodKind.Month -> "周期：本月"
  AnalyticsPeriodKind.AllTime -> "周期：全部"
  AnalyticsPeriodKind.Custom -> "周期：${state.customRange?.label ?: "自定义"}"
}

private fun encode(value: String): String =
  URLEncoder.encode(value, StandardCharsets.UTF_8.toString())

@Composable
private fun TrendAnalyticsTab(state: HubUiState, onEnsureHistory: () -> Unit) {
  var rangeIndex by rememberSaveable { mutableIntStateOf(1) }
  var metricIndex by rememberSaveable { mutableIntStateOf(0) }
  var trendsStack by rememberSaveable { mutableStateOf("client") }
  var activeDaysWindow by rememberSaveable { mutableStateOf("all") }
  var heatmapMetric by rememberSaveable { mutableStateOf("cost") }
  LaunchedEffect(Unit) { onEnsureHistory() }
  val rangeLabels = listOf("7 日", "30 日", "12 月")
  val metricLabels = listOf("Token", "费用", "对比", "活跃")
  val history = state.history ?: state.stats?.historyPreview
  val metric = when (metricIndex) {
    1 -> TrendMetric.Cost
    2 -> TrendMetric.Dual
    3 -> TrendMetric.ActiveTime
    else -> TrendMetric.Tokens
  }
  val heatMetric = if (heatmapMetric == "tokens") HeatmapMetric.Tokens else HeatmapMetric.Cost
  val summary = history?.summary
  val daily = history?.daily.orEmpty()
  val monthly = history?.monthly.orEmpty().takeMonths(12)
  val displayActiveDays = countActiveDays(daily, activeDaysWindow)
  val activeDaysValue = if (activeDaysWindow == "year") {
    displayActiveDays.toString()
  } else if (summary != null) {
    summary.activeDays.toLong().toString()
  } else {
    displayActiveDays.toString()
  }

  if (history == null || (daily.isEmpty() && monthly.isEmpty())) {
    EmptyState(
      text = "Hub 暂无历史预览。设备上报历史后，这里会显示 7/30 日与 12 月趋势。",
      icon = Icons.Outlined.Timeline
    )
    return
  }

  LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(16.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp)
  ) {
    item {
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        rangeLabels.forEachIndexed { index, label ->
          FilterChip(
            selected = rangeIndex == index,
            onClick = { rangeIndex = index },
            label = { Text(label) }
          )
        }
      }
    }
    item {
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        metricLabels.forEachIndexed { index, label ->
          FilterChip(
            selected = metricIndex == index,
            onClick = { metricIndex = index },
            label = { Text(label) }
          )
        }
      }
    }

    if (summary != null) {
      item {
        AppCard {
          Text("历史摘要", style = MaterialTheme.typography.titleMedium)
          Spacer(Modifier.height(10.dp))
          SummaryGrid(
            listOf(
              "活跃天" to activeDaysValue,
              "连胜" to "${summary.currentStreak.toLong()} 天",
              "最长连胜" to "${summary.longestStreak.toLong()} 天",
              "峰值日" to formatTokensShort(summary.peakDayTokens.toLong()),
              "累计" to formatTokensShort(summary.totalTokens.toLong()),
              "费用" to formatUsd(summary.totalCost, compact = true)
            )
          )
          summary.favoriteModel?.takeIf { it.isNotBlank() }?.let {
            Spacer(Modifier.height(8.dp))
            Text(
              "常用模型 $it",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
      }
    }

    item {
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("all" to "全部活跃天", "year" to "近一年").forEach { (key, label) ->
          FilterChip(
            selected = activeDaysWindow == key,
            onClick = { activeDaysWindow = key },
            label = { Text(label) }
          )
        }
      }
    }

    item {
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        listOf("client" to "按客户端", "model" to "按模型").forEach { (key, label) ->
          FilterChip(
            selected = trendsStack == key,
            onClick = { trendsStack = key },
            label = { Text(label) }
          )
        }
      }
    }

    if (daily.isNotEmpty()) {
      item {
        AppCard {
          Text("贡献热力图", style = MaterialTheme.typography.titleMedium)
          Spacer(Modifier.height(8.dp))
          ContributionHeatmap(
            daily = daily,
            metric = heatMetric,
            onMetricChange = { next ->
              heatmapMetric = if (next == HeatmapMetric.Tokens) "tokens" else "cost"
            }
          )
        }
      }
    }

    item {
      AppCard {
        val title = when (rangeIndex) {
          0 -> "近 7 日"
          1 -> "近 30 日"
          else -> "近 12 月"
        }
        Text(
          "$title · ${when (metric) { TrendMetric.Cost -> "费用"; TrendMetric.Dual -> "Token+费用"; TrendMetric.ActiveTime -> "活跃时长"; else -> "Token" }}",
          style = MaterialTheme.typography.titleMedium
        )
        Spacer(Modifier.height(12.dp))
        if (rangeIndex == 2) {
          if (monthly.isEmpty()) {
            Text("暂无月度数据", color = MaterialTheme.colorScheme.onSurfaceVariant)
          } else {
            MonthlyTrendChart(months = monthly, metric = metric)
          }
        } else {
          val range = if (rangeIndex == 0) TrendRange.Days7 else TrendRange.Days30
          val days = daily.takeRange(range)
          if (days.isEmpty()) {
            Text("暂无日度数据", color = MaterialTheme.colorScheme.onSurfaceVariant)
          } else {
            DailyTrendChart(
              days = days,
              metric = metric,
              useLine = rangeIndex == 1
            )
            Spacer(Modifier.height(12.dp))
            StackedDailyTrendChart(
              days = days,
              stackMode = if (trendsStack == "model") TrendStackMode.Model else TrendStackMode.Client
            )
          }
        }
      }
    }

    item { LimitsSection(state.stats?.limits, title = "限额状态") }
  }
}

@Composable
private fun SummaryGrid(items: List<Pair<String, String>>) {
  Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    items.chunked(2).forEach { row ->
      Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
      ) {
        row.forEach { (label, value) ->
          Surface(
            modifier = Modifier.weight(1f),
            shape = MaterialTheme.shapes.medium,
            color = MaterialTheme.colorScheme.surfaceContainerHigh
          ) {
            Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
              Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
              Text(value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            }
          }
        }
        if (row.size == 1) Spacer(Modifier.weight(1f))
      }
    }
  }
}


