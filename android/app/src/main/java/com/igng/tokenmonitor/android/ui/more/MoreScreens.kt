package com.igng.tokenmonitor.android.ui.more

import androidx.compose.ui.text.font.FontWeight

import com.igng.tokenmonitor.android.ui.components.LimitsSection
import com.igng.tokenmonitor.android.ui.components.formatRelativeTime
import com.igng.tokenmonitor.android.ui.components.wslStatusLabel
import com.igng.tokenmonitor.android.ui.components.devicePlatformLabel
import com.igng.tokenmonitor.android.ui.components.agentRuntimeLabel

import androidx.compose.material.icons.outlined.MonitorHeart



import android.net.Uri

import androidx.compose.foundation.background

import androidx.compose.foundation.border

import androidx.compose.foundation.clickable

import androidx.compose.foundation.layout.size

import androidx.compose.foundation.shape.CircleShape

import androidx.compose.material3.FilterChip

import androidx.compose.ui.draw.clip

import androidx.hilt.navigation.compose.hiltViewModel

import androidx.lifecycle.compose.collectAsStateWithLifecycle

import com.igng.tokenmonitor.android.data.local.HapticsMode

import com.igng.tokenmonitor.android.data.local.ThemeSeedId

import com.igng.tokenmonitor.android.ui.PreferencesViewModel

import com.igng.tokenmonitor.android.ui.haptics.HapticEvent

import com.igng.tokenmonitor.android.ui.haptics.rememberAppHaptics

import com.igng.tokenmonitor.android.ui.theme.themeSeedSwatch

import androidx.compose.foundation.layout.Box

import androidx.compose.foundation.layout.Arrangement

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

import androidx.compose.foundation.lazy.items

import androidx.compose.foundation.rememberScrollState

import androidx.compose.foundation.verticalScroll

import androidx.compose.material.icons.Icons

import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Home

import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight

import androidx.compose.material.icons.filled.Add

import androidx.compose.material.icons.filled.Refresh

import androidx.compose.material.icons.outlined.AttachMoney

import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Folder

import androidx.compose.material.icons.outlined.Info

import androidx.compose.material.icons.outlined.Settings

import androidx.compose.material3.AlertDialog

import androidx.compose.material3.Button

import androidx.compose.material3.ExperimentalMaterial3Api

import androidx.compose.material3.FloatingActionButton

import androidx.compose.material3.Icon

import androidx.compose.material3.IconButton

import androidx.compose.material3.MaterialTheme

import androidx.compose.material3.OutlinedButton

import androidx.compose.material3.OutlinedTextField

import androidx.compose.material3.Text

import androidx.compose.material3.TextButton

import androidx.compose.material3.TopAppBar

import androidx.compose.runtime.Composable

import androidx.compose.runtime.getValue

import androidx.compose.runtime.mutableStateOf

import androidx.compose.runtime.remember

import androidx.compose.runtime.setValue

import androidx.compose.ui.Alignment

import androidx.compose.ui.Modifier

import androidx.compose.ui.graphics.vector.ImageVector

import androidx.compose.ui.platform.LocalUriHandler

import androidx.compose.ui.text.input.PasswordVisualTransformation

import androidx.compose.ui.text.input.VisualTransformation

import androidx.compose.ui.text.style.TextOverflow

import androidx.compose.ui.unit.dp

import androidx.navigation.NavHostController

import com.igng.tokenmonitor.android.BuildConfig

import com.igng.tokenmonitor.android.data.model.BatchPricingResultDto

import com.igng.tokenmonitor.android.data.model.PeriodDto
import com.igng.tokenmonitor.android.data.model.ProjectDto

import com.igng.tokenmonitor.android.data.model.PricingDto

import com.igng.tokenmonitor.android.data.model.PricingRequestDto

import com.igng.tokenmonitor.android.data.model.SessionDto

import com.igng.tokenmonitor.android.data.model.StatsDto

import com.igng.tokenmonitor.android.ui.ConnectionUiState

import com.igng.tokenmonitor.android.ui.ConnectionViewModel

import com.igng.tokenmonitor.android.ui.HubUiState

import com.igng.tokenmonitor.android.ui.HubViewModel

import com.igng.tokenmonitor.android.ui.components.AppCard

import com.igng.tokenmonitor.android.ui.components.ShareEntry

import com.igng.tokenmonitor.android.ui.components.ShareBarList

import com.igng.tokenmonitor.android.ui.components.SectionHeader

import com.igng.tokenmonitor.android.ui.components.ClientMonogram

import com.igng.tokenmonitor.android.ui.components.ClientBranding

import com.igng.tokenmonitor.android.ui.components.EmptyState

import com.igng.tokenmonitor.android.ui.components.MetricHeroCard

import com.igng.tokenmonitor.android.ui.components.SegmentedTokenBar

import com.igng.tokenmonitor.android.ui.components.formatTokens

import com.igng.tokenmonitor.android.ui.components.formatTokensShort

import com.igng.tokenmonitor.android.ui.components.formatUsd



@Composable

fun MoreHubScreen(navController: NavHostController, state: HubUiState) {

  Column(Modifier.fillMaxSize()) {

    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {

      Text("更多", style = MaterialTheme.typography.headlineSmall)

      Text(

        "对话、项目、定价与连接设置",

        style = MaterialTheme.typography.bodySmall,

        color = MaterialTheme.colorScheme.onSurfaceVariant

      )

    }

    LazyColumn(

      contentPadding = PaddingValues(16.dp),

      verticalArrangement = Arrangement.spacedBy(10.dp)

    ) {

      item {

        MoreNavCard(

          title = "对话",

          subtitle = "查看会话快照与 token 拆解",

          icon = Icons.Outlined.ChatBubbleOutline,

          onClick = { navController.navigate("sessions") }

        )

      }

      item {
        MoreNavCard(
          title = "项目",
          subtitle = "按工作区汇总 token / 费用",
          icon = Icons.Outlined.Folder,
          onClick = { navController.navigate("projects") }
        )
      }
      item {
        MoreNavCard(
          title = "服务状态",
          subtitle = "各账号额度与健康状态",
          icon = Icons.Outlined.MonitorHeart,
          onClick = { navController.navigate("status") }
        )
      }
      if (state.authorization?.capabilities?.pricing == true && state.authorization.scopes.contains("admin")) item {

        MoreNavCard(

          title = "定价",

          subtitle = "管理模型单价与上游同步",

          icon = Icons.Outlined.AttachMoney,

          onClick = { navController.navigate("pricing") }

        )

      }

      item {

        MoreNavCard(

          title = "设置",

          subtitle = "主题色、触感与 Hub 连接",

          icon = Icons.Outlined.Settings,

          onClick = { navController.navigate("settings") }

        )

      }

    }

  }

}



@Composable

private fun MoreNavCard(

  title: String,

  subtitle: String,

  icon: ImageVector,

  onClick: () -> Unit

) {

  val haptics = rememberAppHaptics()

  AppCard(onClick = {

    haptics.perform(HapticEvent.Tap)

    onClick()

  }) {

    Row(

      Modifier.fillMaxWidth(),

      verticalAlignment = Alignment.CenterVertically

    ) {

      Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)

      Spacer(Modifier.width(14.dp))

      Column(Modifier.weight(1f)) {

        Text(title, style = MaterialTheme.typography.titleMedium)

        Text(

          subtitle,

          style = MaterialTheme.typography.bodySmall,

          color = MaterialTheme.colorScheme.onSurfaceVariant

        )

      }

      Icon(

        Icons.AutoMirrored.Filled.KeyboardArrowRight,

        contentDescription = null,

        tint = MaterialTheme.colorScheme.onSurfaceVariant

      )

    }

  }

}



private const val MAX_SESSION_ROWS = 200

@OptIn(ExperimentalMaterial3Api::class)


@Composable
fun NavigateHomeAction(onHome: (() -> Unit)?) {
  if (onHome == null) return
  val haptics = rememberAppHaptics()
  IconButton(onClick = {
    haptics.perform(HapticEvent.Tap)
    onHome()
  }) {
    Icon(Icons.Filled.Home, contentDescription = "首页")
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionsScreen(stats: StatsDto?, navController: NavHostController, onHome: (() -> Unit)? = null) {

  val haptics = rememberAppHaptics()

  val allSessions = availableSessions(stats)
  val totalSessions = allSessions.size
  val sessions = allSessions.take(MAX_SESSION_ROWS)
  val sessionsTruncated = totalSessions > sessions.size

  val costRank = allSessions

    .sortedByDescending { it.second.costUsd }

    .take(8)

    .map { (key, session) ->

      val label = buildString {
        val client = session.client?.let { ClientBranding.label(it) }.orEmpty()
        if (client.isNotBlank()) append(client)
        session.projectLabel?.takeIf { it.isNotBlank() }?.let {
          if (isNotEmpty()) append(" · ")
          append(it)
        }
        val sid = session.sessionId.orEmpty().ifBlank { key }
        val short = if (sid.length > 18) sid.take(16) + "…" else sid
        if (isNotEmpty()) append(" · ")
        append(short)
      }

      ShareEntry(

        key = label,

        tokens = session.totalTokens.coerceAtLeast(0L),

        costUsd = session.costUsd

      )

    }

  Column(Modifier.fillMaxSize()) {

    TopAppBar(

      title = { Text("对话") },

      navigationIcon = {

        IconButton(onClick = {
          haptics.perform(HapticEvent.Tap)
          navController.popBackStack()
        }) {

          Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")

        }

      },
      actions = { NavigateHomeAction(onHome) }
    )

    if (sessions.isEmpty()) {

      EmptyState(title = "暂无对话", text = "Hub 当前没有可用的会话快照。")

    } else {

      LazyColumn(

        contentPadding = PaddingValues(16.dp),

        verticalArrangement = Arrangement.spacedBy(10.dp)

      ) {

        if (sessionsTruncated) {
          item {
            AppCard {
              Text(
                "显示 ${sessions.size}/$totalSessions 个会话（已截断以提升性能）。",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }
        }

        if (costRank.isNotEmpty()) {

          item {

            AppCard {

              SectionHeader(

                title = "费用排行",

                subtitle = "按会话费用 Top ${costRank.size}"

              )

              Spacer(Modifier.height(12.dp))

              ShareBarList(entries = costRank, brandClients = false, showCost = true)

            }

          }

        }

        items(sessions, key = { it.first }) { (key, session) ->

          val clientId = session.client.orEmpty()

          AppCard(onClick = {
          haptics.perform(HapticEvent.Tap)
          navController.navigate("session/${Uri.encode(key)}")
        }) {

            Row(verticalAlignment = Alignment.CenterVertically) {

              if (clientId.isNotBlank()) {

                ClientMonogram(clientId, size = 28.dp)

                Spacer(Modifier.width(10.dp))

              }

              Column(Modifier.weight(1f)) {

                Text(

                  if (clientId.isBlank()) "未知客户端" else ClientBranding.label(clientId),

                  style = MaterialTheme.typography.labelLarge,

                  color = MaterialTheme.colorScheme.primary

                )

                Text(

                  session.sessionId.orEmpty().ifBlank { key },

                  style = MaterialTheme.typography.titleMedium,

                  maxLines = 1,

                  overflow = TextOverflow.Ellipsis

                )

              }

            }

            Spacer(Modifier.height(8.dp))

            Row(

              Modifier.fillMaxWidth(),

              horizontalArrangement = Arrangement.SpaceBetween

            ) {

              Text(formatTokensShort(session.totalTokens), style = MaterialTheme.typography.titleSmall)

              Text(

                formatUsd(session.costUsd, compact = true),

                style = MaterialTheme.typography.titleSmall,

                color = MaterialTheme.colorScheme.onSurfaceVariant

              )

            }

            Spacer(Modifier.height(4.dp))

            Text(

              "消息 ${session.messageCount} · 最后使用 ${session.lastUsedAt ?: "未知"}",

              style = MaterialTheme.typography.bodySmall,

              color = MaterialTheme.colorScheme.onSurfaceVariant

            )

          }

        }

      }

    }

  }

}



@OptIn(ExperimentalMaterial3Api::class)

@Composable

fun SessionDetailScreen(stats: StatsDto?, key: String, onBack: () -> Unit, onHome: (() -> Unit)? = null) {

  val haptics = rememberAppHaptics()

  val session = availableSessions(stats).firstOrNull { it.first == key }?.second

  Column(Modifier.fillMaxSize()) {

    TopAppBar(

      title = { Text("对话详情") },

      navigationIcon = {

        IconButton(onClick = {
          haptics.perform(HapticEvent.Tap)
          onBack()
        }) {

          Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")

        }

      },
      actions = { NavigateHomeAction(onHome) }
    )

    if (session == null) {

      EmptyState(text = "会话不在当前 Hub 快照中。")

      return

    }

    Column(

      Modifier

        .fillMaxSize()

        .verticalScroll(rememberScrollState())

        .padding(16.dp),

      verticalArrangement = Arrangement.spacedBy(14.dp)

    ) {

      Row(verticalAlignment = Alignment.CenterVertically) {

        val clientId = session.client.orEmpty()

        if (clientId.isNotBlank()) {

          ClientMonogram(clientId, size = 36.dp)

          Spacer(Modifier.width(12.dp))

        }

        Column {

          Text(

            if (clientId.isBlank()) "未知客户端" else ClientBranding.label(clientId),

            style = MaterialTheme.typography.labelLarge,

            color = MaterialTheme.colorScheme.primary

          )

          Text(

            session.sessionId.orEmpty().ifBlank { key },

            style = MaterialTheme.typography.headlineSmall

          )

        }

      }

      session.projectLabel?.takeIf { it.isNotBlank() }?.let { projectLabel ->

        Text(

          "项目 " + projectLabel,

          style = MaterialTheme.typography.bodyMedium,

          color = MaterialTheme.colorScheme.onSurfaceVariant

        )

      }

      MetricHeroCard(

        title = "累计用量",

        period = PeriodDto(totalTokens = session.totalTokens, costUsd = session.costUsd)

      )

      AppCard {

        Text("Token 类型", style = MaterialTheme.typography.titleMedium)

        Spacer(Modifier.height(12.dp))

        SegmentedTokenBar(

          listOf(

            "输入" to session.inputTokens,

            "输出" to session.outputTokens,

            "缓存读取" to session.cacheReadTokens,

            "缓存写入" to session.cacheWriteTokens,

            "推理" to session.reasoningTokens

          )

        )

        Spacer(Modifier.height(10.dp))

        Text(

          "消息 ${session.messageCount} · 开始 ${session.startedAt ?: "未知"} · 最后使用 ${session.lastUsedAt ?: "未知"}",

          style = MaterialTheme.typography.bodySmall,

          color = MaterialTheme.colorScheme.onSurfaceVariant

        )

      }

      if (session.models.isNotEmpty()) {

        AppCard {

          Text("模型", style = MaterialTheme.typography.titleMedium)

          Spacer(Modifier.height(8.dp))

          session.models.entries.sortedByDescending { it.value }.forEach { (model, tokens) ->

            Row(

              Modifier

                .fillMaxWidth()

                .padding(vertical = 6.dp),

              horizontalArrangement = Arrangement.SpaceBetween

            ) {

              Text(

                model,

                style = MaterialTheme.typography.bodyMedium,

                maxLines = 1,

                overflow = TextOverflow.Ellipsis,

                modifier = Modifier.weight(1f)

              )

              Spacer(Modifier.width(8.dp))

              Text(formatTokens(tokens), style = MaterialTheme.typography.bodyMedium)

            }

          }

        }

      }

      Text(

        "当前 Hub 未提供按会话和时间范围查询事件流水的接口；此页展示已有 stats 快照，不会虚构历史趋势。",

        style = MaterialTheme.typography.bodySmall,

        color = MaterialTheme.colorScheme.onSurfaceVariant

      )

    }

  }

}



@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectsScreen(stats: StatsDto?, onBack: () -> Unit, onHome: (() -> Unit)? = null) {
  val haptics = rememberAppHaptics()

  var periodKey by remember { mutableStateOf("today") }
  val period = when (periodKey) {
    "month" -> stats?.periods?.month
    "allTime" -> stats?.periods?.allTime
    else -> stats?.periods?.today
  }
  val projects = period?.projects.orEmpty().entries
    .map { (key, project) -> key to project }
    .filter { (_, project) -> project.tokens > 0L || project.costUsd > 0.0 }
    .sortedByDescending { it.second.tokens }

  Column(Modifier.fillMaxSize()) {
    TopAppBar(
      title = { Text("项目") },
      navigationIcon = {
        IconButton(onClick = {
          haptics.perform(HapticEvent.Tap)
          onBack()
        }) {
          Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
        }
      },
      actions = { NavigateHomeAction(onHome) }
    )
    Row(
      Modifier.padding(horizontal = 16.dp),
      horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      listOf("today" to "今日", "month" to "本月", "allTime" to "全部").forEach { (key, label) ->
        FilterChip(
          selected = periodKey == key,
          onClick = {
            haptics.perform(HapticEvent.Selection)
            periodKey = key
          },
          label = { Text(label) }
        )
      }
    }
    Spacer(Modifier.height(8.dp))
    val showIncomplete = periodKey == "allTime" && stats?.projectsIncomplete == true
    if (projects.isEmpty()) {
      if (showIncomplete) {
        AppCard(modifier = Modifier.padding(horizontal = 16.dp)) {
          Text(
            "部分设备未上报全部时间的项目汇总，统计可能不完整。",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
        Spacer(Modifier.height(12.dp))
      }
      EmptyState(text = "当前周期暂无项目数据。")
      return
    }
    LazyColumn(
      contentPadding = PaddingValues(16.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
      if (showIncomplete) {
        item {
          AppCard {
            Text(
              "部分设备未上报全部时间的项目汇总，统计可能不完整。",
              style = MaterialTheme.typography.bodyMedium,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
      }
      items(projects, key = { it.first }) { (key, project) ->
        AppCard {
          Text(
            project.label?.takeIf { it.isNotBlank() } ?: key,
            style = MaterialTheme.typography.titleMedium
          )
          Spacer(Modifier.height(6.dp))
          Text(
            buildString {
              append(formatTokens(project.tokens))
              append(" · ")
              append(formatUsd(project.costUsd, compact = true))
              val clients = project.clients.keys.map { ClientBranding.label(it) }
              if (clients.isNotEmpty()) {
                append(" · ")
                append(clients.joinToString(" / "))
              }
            },
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
          if (project.clients.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            ShareBarList(
              project.clients.entries
                .sortedByDescending { it.value }
                .take(6)
                .map { (client, tokens) ->
                  ShareEntry(
                    key = ClientBranding.label(client),
                    tokens = tokens.coerceAtLeast(0L),
                    costUsd = 0.0
                  )
                }
            )
          }
        }
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)

@Composable

fun PricingScreen(state: HubUiState, viewModel: HubViewModel, onBack: () -> Unit, onHome: (() -> Unit)? = null) {

  val haptics = rememberAppHaptics()

  var editing by remember { mutableStateOf<PricingDto?>(null) }

  var showNew by remember { mutableStateOf(false) }



  androidx.compose.foundation.layout.Box(Modifier.fillMaxSize()) {

    Column(Modifier.fillMaxSize()) {

      TopAppBar(

        title = { Text("定价") },

        navigationIcon = {

          IconButton(onClick = {
          haptics.perform(HapticEvent.Tap)
          onBack()
        }) {

            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")

          }

        },

        actions = {
          NavigateHomeAction(onHome)
          IconButton(onClick = {
            haptics.perform(HapticEvent.Refresh)
            viewModel.refreshPricing()
          }) {
            Icon(Icons.Default.Refresh, contentDescription = "刷新")
          }
        }

      )

      LazyColumn(

        contentPadding = PaddingValues(16.dp),

        verticalArrangement = Arrangement.spacedBy(10.dp)

      ) {

        item {

          Text(

            "修改价格只影响未来产生的用量记录；已写入历史事件的费用快照不会重算。",

            style = MaterialTheme.typography.bodySmall,

            color = MaterialTheme.colorScheme.onSurfaceVariant

          )

        }

        item {

          Button(

            onClick = {
              haptics.perform(HapticEvent.Confirm)
              viewModel.fetchAllUpstream()
            },

            modifier = Modifier.fillMaxWidth()

          ) { Text("批量从上游拉取全部") }

        }

        if (state.pricing.isEmpty()) {

          item {

            EmptyState(text = "Hub 尚未配置任何模型定价。可手动新增，或在设备有模型记录后批量拉取。")

          }

        } else {

          items(state.pricing, key = { it.model }) { pricing ->

            AppCard(onClick = {
              haptics.perform(HapticEvent.Tap)
              editing = pricing
            }) {

              Row(

                Modifier.fillMaxWidth(),

                horizontalArrangement = Arrangement.SpaceBetween,

                verticalAlignment = Alignment.CenterVertically

              ) {

                Column(Modifier.weight(1f)) {

                  Text(pricing.model, style = MaterialTheme.typography.titleMedium)

                  Text(

                    "${pricing.source} · ${pricing.updatedAt ?: "未知时间"}",

                    style = MaterialTheme.typography.bodySmall,

                    color = MaterialTheme.colorScheme.onSurfaceVariant

                  )

                }

                IconButton(onClick = {
                  haptics.perform(HapticEvent.Refresh)
                  viewModel.fetchUpstream(pricing.model)
                }) {

                  Icon(Icons.Default.Refresh, contentDescription = "从上游拉取")

                }

              }

              Spacer(Modifier.height(8.dp))

              Text(

                "输入 ${pricing.inputPricePerMillion} · 输出 ${pricing.outputPricePerMillion}",

                style = MaterialTheme.typography.bodyMedium

              )

              Text(

                "缓存读 ${pricing.cacheReadPricePerMillion} · 缓存写 ${pricing.cacheWritePricePerMillion} / 百万 token",

                style = MaterialTheme.typography.bodySmall,

                color = MaterialTheme.colorScheme.onSurfaceVariant

              )

            }

          }

        }

      }

    }

    FloatingActionButton(

      onClick = {
        haptics.perform(HapticEvent.Tap)
        showNew = true
      },

      modifier = Modifier

        .align(Alignment.BottomEnd)

        .padding(20.dp)

    ) {

      Icon(Icons.Default.Add, contentDescription = "新增")

    }

  }



  if (showNew || editing != null) {

    PricingEditorDialog(

      existing = editing,

      onDismiss = { showNew = false; editing = null },

      onSave = { model, request ->

        viewModel.savePricing(model, request)

        showNew = false

        editing = null

      }

    )

  }

  state.batchResult?.let { result ->

    BatchResultDialog(result.results) { viewModel.clearBatchResult() }

  }

}



@Composable

private fun PricingEditorDialog(

  existing: PricingDto?,

  onDismiss: () -> Unit,

  onSave: (String, PricingRequestDto) -> Unit

) {
  val haptics = rememberAppHaptics()

  var model by remember(existing) { mutableStateOf(existing?.model.orEmpty()) }

  var input by remember(existing) { mutableStateOf(existing?.inputPricePerMillion?.toString().orEmpty()) }

  var output by remember(existing) { mutableStateOf(existing?.outputPricePerMillion?.toString().orEmpty()) }

  var cacheRead by remember(existing) { mutableStateOf(existing?.cacheReadPricePerMillion?.toString().orEmpty()) }

  var cacheWrite by remember(existing) { mutableStateOf(existing?.cacheWritePricePerMillion?.toString().orEmpty()) }

  val values = listOf(input, output, cacheRead, cacheWrite).map { it.toDoubleOrNull() }

  val valid = model.isNotBlank() && values.all { it != null && it >= 0.0 }

  AlertDialog(

    onDismissRequest = onDismiss,

    title = { Text(if (existing == null) "新增模型定价" else "编辑模型定价") },

    text = {

      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {

        OutlinedTextField(

          model,

          { model = it },

          label = { Text("模型") },

          enabled = existing == null,

          singleLine = true

        )

        PriceField("输入 / 百万", input) { input = it }

        PriceField("输出 / 百万", output) { output = it }

        PriceField("缓存读取 / 百万", cacheRead) { cacheRead = it }

        PriceField("缓存写入 / 百万", cacheWrite) { cacheWrite = it }

        if (!valid) {

          Text(

            "模型不能为空，四项价格必须是非负数字。",

            color = MaterialTheme.colorScheme.error,

            style = MaterialTheme.typography.bodySmall

          )

        }

      }

    },

    confirmButton = {

      TextButton(

        enabled = valid,

        onClick = {
        haptics.perform(HapticEvent.Confirm)
        onSave(

            model.trim(),

            PricingRequestDto(values[0]!!, values[1]!!, values[2]!!, values[3]!!)

          )

        }

      ) { Text("保存") }

    },

    dismissButton = { TextButton(onClick = {
      haptics.perform(HapticEvent.Tap)
      onDismiss()
    }) { Text("取消") } }

  )

}



@Composable

private fun PriceField(label: String, value: String, onChange: (String) -> Unit) {

  OutlinedTextField(value, onChange, label = { Text(label) }, singleLine = true)

}



@Composable

private fun BatchResultDialog(results: List<BatchPricingResultDto>, dismiss: () -> Unit) {
  val haptics = rememberAppHaptics()

  AlertDialog(

    onDismissRequest = dismiss,

    title = { Text("批量拉取结果") },

    text = {

      Column(Modifier.verticalScroll(rememberScrollState())) {

        results.forEach { result ->

          Text("${result.model}: ${if (result.ok) "成功" else result.message ?: result.error ?: "失败"}")

        }

      }

    },

    confirmButton = { TextButton(onClick = {
      haptics.perform(HapticEvent.Tap)
      dismiss()
    }) { Text("关闭") } }

  )

}



@OptIn(ExperimentalMaterial3Api::class)

@Composable

fun SettingsScreen(

  state: ConnectionUiState,

  viewModel: ConnectionViewModel,

  restartRealtime: () -> Unit,

  onBack: () -> Unit, onHome: (() -> Unit)? = null,

  preferencesViewModel: PreferencesViewModel = hiltViewModel()

) {

  val uriHandler = LocalUriHandler.current

  val prefs by preferencesViewModel.preferences.collectAsStateWithLifecycle()

  val haptics = rememberAppHaptics()



  Column(Modifier.fillMaxSize()) {

    TopAppBar(

      title = { Text("设置") },

      navigationIcon = {

        IconButton(onClick = {

          haptics.perform(HapticEvent.Tap)

          onBack()

        }) {

          Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")

        }

      },
      actions = { NavigateHomeAction(onHome) }
    )

    Column(

      Modifier

        .fillMaxSize()

        .verticalScroll(rememberScrollState())

        .padding(16.dp),

      verticalArrangement = Arrangement.spacedBy(14.dp)

    ) {

      AppCard {

        Text("外观", style = MaterialTheme.typography.titleMedium)

        Text(

          "主题色会应用到按钮、导航与强调色。选择「系统」可跟随壁纸动态取色（Android 12+）。",

          style = MaterialTheme.typography.bodySmall,

          color = MaterialTheme.colorScheme.onSurfaceVariant

        )

        Spacer(Modifier.height(12.dp))

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {

          listOf(

            listOf(ThemeSeedId.System, ThemeSeedId.Blue, ThemeSeedId.Green, ThemeSeedId.Purple),

            listOf(ThemeSeedId.Teal, ThemeSeedId.Orange, ThemeSeedId.Rose)

          ).forEach { rowSeeds ->

            Row(

              Modifier.fillMaxWidth(),

              horizontalArrangement = Arrangement.spacedBy(12.dp)

            ) {

              rowSeeds.forEach { seed ->

                val selected = prefs.themeSeed == seed

                val swatch = themeSeedSwatch(seed)

                Column(

                  horizontalAlignment = Alignment.CenterHorizontally,

                  modifier = Modifier

                    .weight(1f)

                    .clickable {

                      preferencesViewModel.setThemeSeed(seed)

                      haptics.perform(HapticEvent.Selection)

                    }

                ) {

                  Box(

                    Modifier

                      .size(40.dp)

                      .clip(CircleShape)

                      .background(swatch)

                      .then(

                        if (selected) {

                          Modifier.border(3.dp, MaterialTheme.colorScheme.onSurface, CircleShape)

                        } else {

                          Modifier.border(1.dp, MaterialTheme.colorScheme.outlineVariant, CircleShape)

                        }

                      )

                  )

                  Spacer(Modifier.height(4.dp))

                  Text(

                    seed.labelZh,

                    style = MaterialTheme.typography.labelSmall,

                    color = if (selected) {

                      MaterialTheme.colorScheme.primary

                    } else {

                      MaterialTheme.colorScheme.onSurfaceVariant

                    },

                    maxLines = 1

                  )

                }

              }

              // keep second row spacing balanced when only 3 chips

              if (rowSeeds.size < 4) {

                repeat(4 - rowSeeds.size) { Spacer(Modifier.weight(1f)) }

              }

            }

          }

        }

      }



            AppCard {
        Text("首页额度账号数", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(4.dp))
        Text(
          "总览页最多展示多少个额度账号（1–12）",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(12.dp))
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
          OutlinedButton(
            onClick = {
              preferencesViewModel.setHomeLimitAccountCount(prefs.homeLimitAccountCount - 1)
              haptics.perform(HapticEvent.Selection)
            },
            enabled = prefs.homeLimitAccountCount > 1
          ) { Text("−") }
          Text(
            prefs.homeLimitAccountCount.toString(),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold
          )
          OutlinedButton(
            onClick = {
              preferencesViewModel.setHomeLimitAccountCount(prefs.homeLimitAccountCount + 1)
              haptics.perform(HapticEvent.Selection)
            },
            enabled = prefs.homeLimitAccountCount < 12
          ) { Text("+") }
        }
      }

      AppCard {

        Text("触感反馈", style = MaterialTheme.typography.titleMedium)

        Text(

          "标准：按钮轻触反馈。增强：切换、成功、错误等使用更丰富的震动模式。",

          style = MaterialTheme.typography.bodySmall,

          color = MaterialTheme.colorScheme.onSurfaceVariant

        )

        Spacer(Modifier.height(10.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {

          HapticsMode.entries.forEach { mode ->

            FilterChip(

              selected = prefs.hapticsMode == mode,

              onClick = {

                preferencesViewModel.setHapticsMode(mode)

                if (mode != HapticsMode.Off) {

                  haptics.perform(

                    if (mode == HapticsMode.Enhanced) HapticEvent.Confirm else HapticEvent.Tap,

                    forceMode = mode

                  )

                }

              },

              label = { Text(mode.labelZh) }

            )

          }

        }

        if (prefs.hapticsMode == HapticsMode.Enhanced) {

          Spacer(Modifier.height(8.dp))

          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {

            OutlinedButton(onClick = { haptics.perform(HapticEvent.Success) }) { Text("试听成功") }

            OutlinedButton(onClick = { haptics.perform(HapticEvent.Error) }) { Text("试听错误") }

            OutlinedButton(onClick = { haptics.perform(HapticEvent.Refresh) }) { Text("试听刷新") }

          }

        }

      }



      AppCard {

        Text("Hub 连接", style = MaterialTheme.typography.titleMedium)

        Spacer(Modifier.height(12.dp))

        OutlinedTextField(

          state.hubUrl,

          viewModel::updateUrl,

          label = { Text("Hub URL") },

          placeholder = { Text("https://hub.example.com") },

          singleLine = true,

          modifier = Modifier.fillMaxWidth()

        )

        Spacer(Modifier.height(10.dp))

        OutlinedTextField(

          state.secret,

          viewModel::updateSecret,

          label = { Text("共享密钥") },

          visualTransformation = if (state.secret.isEmpty()) {

            VisualTransformation.None

          } else {

            PasswordVisualTransformation()

          },

          singleLine = true,

          modifier = Modifier.fillMaxWidth()

        )

        Spacer(Modifier.height(12.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {

          Button(

            onClick = {

              haptics.perform(HapticEvent.Confirm)

              viewModel.testConnection()

            },

            enabled = !state.testing

          ) { Text(if (state.testing) "测试中" else "测试连接") }

          OutlinedButton(onClick = {

            haptics.perform(HapticEvent.Success)

            viewModel.save()

            restartRealtime()

          }) { Text("加密保存") }

        }

        TextButton(onClick = {

          haptics.perform(HapticEvent.Error)

          viewModel.clear()

        }) { Text("清除本机连接") }

      }



      AppCard {

        Row(verticalAlignment = Alignment.CenterVertically) {

          Icon(Icons.Outlined.Info, contentDescription = null, tint = MaterialTheme.colorScheme.primary)

          Spacer(Modifier.width(10.dp))

          Text("关于", style = MaterialTheme.typography.titleMedium)

        }

        Spacer(Modifier.height(10.dp))

        Text(

          "本项目基于 Javis603/token-monitor，遵循 MIT License。",

          style = MaterialTheme.typography.bodyMedium

        )

        Spacer(Modifier.height(6.dp))

        Text(

          "当前 Android 版本：${BuildConfig.VERSION_NAME}",

          style = MaterialTheme.typography.bodySmall,

          color = MaterialTheme.colorScheme.onSurfaceVariant

        )

        state.health?.version?.let {

          Text(

            "当前连接 Hub 版本：$it",

            style = MaterialTheme.typography.bodySmall,

            color = MaterialTheme.colorScheme.onSurfaceVariant

          )

        }

        Spacer(Modifier.height(4.dp))

        TextButton(

          onClick = {

            haptics.perform(HapticEvent.Tap)

            uriHandler.openUri("https://github.com/IGNGserver/token-monitor-suite/releases/latest")

          }

        ) { Text("检查并下载最新 Android 版本") }

      }

    }

  }

}



fun availableSessions(stats: StatsDto?): List<Pair<String, SessionDto>> {

  val periods = listOf(stats?.periods?.today, stats?.periods?.month, stats?.periods?.allTime)

  return periods

    .firstOrNull { !it?.sessions.isNullOrEmpty() }

    ?.sessions

    .orEmpty()

    .toList()

    .sortedByDescending { it.second.lastUsedAt.orEmpty() }

}





@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatusScreen(stats: StatsDto?, onBack: () -> Unit, onHome: (() -> Unit)? = null) {
  val haptics = rememberAppHaptics()

  val providers = stats?.limits?.providers.orEmpty()
  val devices = stats?.devices.orEmpty()
  val okCount = providers.count { !it.status.isNullOrBlank() && it.status.equals("ok", ignoreCase = true) }
  val warnCount = providers.size - okCount
  val staleCount = devices.count { it.stale == true }
  Column(Modifier.fillMaxSize()) {
    TopAppBar(
      title = { Text("服务状态") },
      navigationIcon = {
        IconButton(onClick = {
          haptics.perform(HapticEvent.Tap)
          onBack()
        }) {
          Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
        }
      },
      actions = { NavigateHomeAction(onHome) }
    )
    if (providers.isEmpty() && devices.isEmpty()) {
      EmptyState(text = "暂无服务状态数据。")
      return
    }
    LazyColumn(
      contentPadding = PaddingValues(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
      item {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          SummaryChip(label = "账户", value = providers.size.toString(), modifier = Modifier.weight(1f))
          SummaryChip(label = "正常", value = okCount.toString(), modifier = Modifier.weight(1f))
          SummaryChip(label = "需关注", value = warnCount.toString(), modifier = Modifier.weight(1f))
        }
      }
      if (devices.isNotEmpty()) {
        item {
          Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            SummaryChip(label = "设备", value = devices.size.toString(), modifier = Modifier.weight(1f))
            SummaryChip(label = "过期", value = staleCount.toString(), modifier = Modifier.weight(1f))
          }
        }
        items(devices, key = { it.deviceId.orEmpty().ifBlank { it.hostname.orEmpty() } }) { device ->
          AppCard {
            Text(
              device.hostname?.takeIf { it.isNotBlank() } ?: device.deviceId.orEmpty().ifBlank { "设备" },
              style = MaterialTheme.typography.titleMedium,
              fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(6.dp))
            val bits = buildList {
              devicePlatformLabel(device.platform, device.osName, device.osVersion)
                .takeIf { it.isNotBlank() && it != "—" }
                ?.let { add(it) }
              agentRuntimeLabel(device.agentRuntime).takeIf { it.isNotBlank() }?.let { add(it) }
              if (device.stale == true) add("已过期")
              device.updatedAt?.takeIf { it.isNotBlank() }?.let { add(formatRelativeTime(it)) }
              device.wslStatus?.state?.takeIf { it.isNotBlank() }?.let { add("WSL " + wslStatusLabel(it)) }
            }
            if (bits.isNotEmpty()) {
              Text(
                bits.joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }
        }
      }
      if (providers.isNotEmpty()) {
        item {
          LimitsSection(
            limits = stats?.limits,
            title = "账户额度与状态",
            includeAllProviders = true
          )
        }
      }
    }
  }
}

@Composable
private fun SummaryChip(label: String, value: String, modifier: Modifier = Modifier) {
  AppCard(modifier = modifier) {
    Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Spacer(Modifier.height(4.dp))
    Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
  }
}
