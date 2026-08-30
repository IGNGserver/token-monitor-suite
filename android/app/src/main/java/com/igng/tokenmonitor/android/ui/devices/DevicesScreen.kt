package com.igng.tokenmonitor.android.ui.devices

import android.net.Uri
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
import androidx.compose.material.icons.outlined.Devices
import androidx.compose.material3.ExperimentalMaterial3Api
import com.igng.tokenmonitor.android.ui.components.agentRuntimeLabel
import com.igng.tokenmonitor.android.ui.components.clientStatusLabel
import com.igng.tokenmonitor.android.ui.components.devicePlatformLabel
import com.igng.tokenmonitor.android.ui.components.wslStatusLabel
import com.igng.tokenmonitor.android.ui.components.ClientBranding
import com.igng.tokenmonitor.android.data.model.PeriodDto
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.igng.tokenmonitor.android.data.model.DeviceDto
import com.igng.tokenmonitor.android.ui.components.AppCard
import com.igng.tokenmonitor.android.ui.components.CompactMetricCard
import com.igng.tokenmonitor.android.ui.components.DeviceComparisonChart
import com.igng.tokenmonitor.android.ui.components.EmptyState
import com.igng.tokenmonitor.android.ui.components.DevicesSkeleton
import com.igng.tokenmonitor.android.ui.components.LimitsSection
import com.igng.tokenmonitor.android.ui.components.MetricHeroCard
import com.igng.tokenmonitor.android.ui.components.SectionHeader
import com.igng.tokenmonitor.android.ui.components.ShareBarList
import com.igng.tokenmonitor.android.ui.components.StatusDot
import com.igng.tokenmonitor.android.ui.components.formatTokensShort
import com.igng.tokenmonitor.android.ui.components.formatRelativeTime
import com.igng.tokenmonitor.android.ui.components.formatUsd
import com.igng.tokenmonitor.android.ui.components.topShareEntries

@Composable
fun DevicesScreen(
  devices: List<DeviceDto>,
  navController: NavHostController,
  isLoading: Boolean = false
) {
  val sorted = devices.sortedWith(
    compareBy<DeviceDto> { it.stale }.thenByDescending { it.periods.today.totalTokens }
  )
  val activeDevices = sorted.filterNot { it.stale }
  Column(Modifier.fillMaxSize()) {
    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
      Text("设备", style = MaterialTheme.typography.headlineSmall)
      Text(
        if (devices.isEmpty()) "暂无上报设备"
        else "${devices.count { !it.stale }} 在线 · ${devices.size} 台合计",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
    }
    when {
      isLoading && devices.isEmpty() -> DevicesSkeleton()
      sorted.isEmpty() -> EmptyState(title = "无设备", text = "还没有设备上报到 Hub。", icon = Icons.Outlined.Devices)
      else -> {
        LazyColumn(
          modifier = Modifier.fillMaxSize(),
          contentPadding = PaddingValues(16.dp),
          verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
        item {
          AppCard {
            SectionHeader(
              title = "今日对比",
              subtitle = "按设备 Token 用量"
            )
            Spacer(Modifier.height(12.dp))
            DeviceComparisonChart(devices = activeDevices, limit = 10, showCost = true)
          }
        }
        items(sorted, key = { it.deviceId.orEmpty() }) { device ->
          AppCard(
            onClick = {
              navController.navigate("device/${Uri.encode(device.deviceId.orEmpty())}")
            }
          ) {
            Row(
              Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically
            ) {
              Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
              ) {
                StatusDot(active = !device.stale)
                Spacer(Modifier.width(10.dp))
                Column {
                  Text(
                    device.hostname ?: device.deviceId.orEmpty(),
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                  )
                  Text(
                    buildString {
                      append(devicePlatformLabel(device.platform, device.osName, device.osVersion))
                      append(" · ")
                      append(if (device.stale) "离线" else "在线")
                      agentRuntimeLabel(device.agentRuntime).takeIf { it.isNotBlank() }?.let {
                        append(" · ")
                        append(it)
                      }
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                  )
                }
              }
              Column(horizontalAlignment = Alignment.End) {
                Text(
                  formatTokensShort(device.periods.today.totalTokens),
                  style = MaterialTheme.typography.titleMedium,
                  fontWeight = FontWeight.SemiBold
                )
                Text(
                  formatUsd(device.periods.today.costUsd, compact = true),
                  style = MaterialTheme.typography.labelMedium,
                  color = MaterialTheme.colorScheme.onSurfaceVariant
                )
              }
            }
            Spacer(Modifier.height(10.dp))
            val fraction = run {
              val max = sorted.maxOfOrNull { it.periods.today.totalTokens }?.coerceAtLeast(1L) ?: 1L
              device.periods.today.totalTokens.toFloat() / max.toFloat()
            }
            com.igng.tokenmonitor.android.ui.components.ShareProgressBar(
              fraction = fraction,
              color = MaterialTheme.colorScheme.primary
            )
            Spacer(Modifier.height(6.dp))
            Text(
              "上次上报 ${formatRelativeTime(device.receivedAt)}",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
        }
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeviceDetailScreen(
  device: DeviceDto?,
  onBack: () -> Unit,
  onHome: (() -> Unit)? = null
) {
  var periodKey by rememberSaveable { mutableStateOf("today") }
  Column(Modifier.fillMaxSize()) {
    TopAppBar(
      title = { Text("设备详情") },
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
    if (device == null) {
      EmptyState(text = "设备已从当前 Hub 快照中移除。")
      return
    }
    val selectedPeriod: PeriodDto = when (periodKey) {
      "month" -> device.periods.month
      "allTime" -> device.periods.allTime
      else -> device.periods.today
    }
    val periodLabel = when (periodKey) {
      "month" -> "本月"
      "allTime" -> "全部"
      else -> "今日"
    }
    Column(
      Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        StatusDot(active = !device.stale)
        Spacer(Modifier.width(10.dp))
        Column {
          Text(
            device.hostname ?: device.deviceId.orEmpty(),
            style = MaterialTheme.typography.headlineSmall
          )
          Text(
            buildString {
              append(devicePlatformLabel(device.platform, device.osName, device.osVersion))
              append(" · ")
              append(if (device.stale) "离线" else "在线")
              agentRuntimeLabel(device.agentRuntime).takeIf { it.isNotBlank() }?.let {
                append(" · ")
                append(it)
              }
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
          Text(
            "上次上报 ${formatRelativeTime(device.receivedAt)}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
      }
      if (device.clientStatus.isNotEmpty()) {
        AppCard {
          SectionHeader(title = "工具状态", subtitle = "来自采集端 clientStatus")
          Spacer(Modifier.height(10.dp))
          device.clientStatus.entries
            .sortedBy { it.key }
            .forEach { (client, state) ->
              Row(
                Modifier
                  .fillMaxWidth()
                  .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween
              ) {
                Text(
                  ClientBranding.label(client),
                  style = MaterialTheme.typography.bodyMedium
                )
                Text(
                  clientStatusLabel(state),
                  style = MaterialTheme.typography.labelMedium,
                  color = MaterialTheme.colorScheme.onSurfaceVariant
                )
              }
            }
        }
      }
      device.wslStatus?.state?.takeIf { it.isNotBlank() }?.let { state ->
        AppCard {
          SectionHeader(title = "WSL 状态", subtitle = wslStatusLabel(state))
          Spacer(Modifier.height(8.dp))
          val detected = device.wslStatus?.detected.orEmpty()
          val withData = device.wslStatus?.withData.orEmpty()
          if (detected.isNotEmpty()) {
            Text(
              "已检测：" + detected.joinToString { ClientBranding.label(it) },
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
          if (withData.isNotEmpty()) {
            Text(
              "有数据：" + withData.joinToString { ClientBranding.label(it) },
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
      }
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(
          "today" to "今日",
          "month" to "本月",
          "allTime" to "全部"
        ).forEach { (key, label) ->
          FilterChip(
            selected = periodKey == key,
            onClick = { periodKey = key },
            label = { Text(label) }
          )
        }
      }
      MetricHeroCard(title = periodLabel, period = selectedPeriod)
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        CompactMetricCard(
          title = "本月",
          period = device.periods.month,
          modifier = Modifier.weight(1f)
        )
        CompactMetricCard(
          title = "全部时间",
          period = device.periods.allTime,
          modifier = Modifier.weight(1f)
        )
      }
      val clients = topShareEntries(
        selectedPeriod.clients,
        selectedPeriod.clientCosts,
        limit = 6
      )
      if (clients.isNotEmpty()) {
        AppCard {
          SectionHeader(title = "${periodLabel}客户端", subtitle = "本设备 · 可展开模型")
          Spacer(Modifier.height(12.dp))
          clients.forEach { entry ->
            ShareBarList(listOf(entry))
            if (entry.key != "其他") {
              val nested = selectedPeriod.clientModels[entry.key].orEmpty()
              val nestedCosts = selectedPeriod.clientModelCosts[entry.key].orEmpty()
              val modelEntries = topShareEntries(nested, nestedCosts, limit = 6)
              if (modelEntries.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                Text(
                  "${ClientBranding.label(entry.key)} 模型",
                  style = MaterialTheme.typography.labelMedium,
                  color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(6.dp))
                ShareBarList(modelEntries, brandClients = false)
              }
            }
            Spacer(Modifier.height(10.dp))
          }
        }
      }
      val models = topShareEntries(
        selectedPeriod.models,
        selectedPeriod.modelCosts,
        limit = 6
      )
      if (models.isNotEmpty()) {
        AppCard {
          SectionHeader(title = "${periodLabel}模型", subtitle = "本设备汇总")
          Spacer(Modifier.height(12.dp))
          ShareBarList(models, brandClients = false)
        }
      }
      LimitsSection(device.limits, title = "本设备限额")
    }
  }
}
