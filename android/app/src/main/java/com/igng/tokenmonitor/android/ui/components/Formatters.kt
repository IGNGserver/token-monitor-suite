package com.igng.tokenmonitor.android.ui.components

import com.igng.tokenmonitor.android.data.model.HistoryDayDto
import java.text.NumberFormat
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs

private val integerFormat: NumberFormat = NumberFormat.getIntegerInstance(Locale.getDefault())
private val shortDateTime: DateTimeFormatter =
  DateTimeFormatter.ofPattern("MM-dd HH:mm", Locale.getDefault())

fun formatTokens(value: Long, compact: Boolean = false): String {
  if (!compact) return integerFormat.format(value) + " token"
  val abs = abs(value.toDouble())
  val formatted = when {
    abs >= 1_000_000_000 -> String.format(Locale.US, "%.1fB", value / 1_000_000_000.0)
    abs >= 1_000_000 -> String.format(Locale.US, "%.1fM", value / 1_000_000.0)
    abs >= 10_000 -> String.format(Locale.US, "%.1fK", value / 1_000.0)
    else -> integerFormat.format(value)
  }
  return "$formatted token"
}

fun formatTokensShort(value: Long): String {
  val abs = abs(value.toDouble())
  return when {
    abs >= 1_000_000_000 -> String.format(Locale.US, "%.1fB", value / 1_000_000_000.0)
    abs >= 1_000_000 -> String.format(Locale.US, "%.1fM", value / 1_000_000.0)
    abs >= 1_000 -> String.format(Locale.US, "%.1fK", value / 1_000.0)
    else -> integerFormat.format(value)
  }
}

fun formatUsd(value: Double, compact: Boolean = false): String {
  if (compact && abs(value) >= 1000) {
    return "US$" + String.format(Locale.US, "%.1fK", value / 1000.0)
  }
  val decimals = when {
    abs(value) >= 100 -> 2
    abs(value) >= 1 -> 3
    else -> 4
  }
  return "US$" + String.format(Locale.US, "%.${decimals}f", value)
}

fun formatPercent(part: Long, total: Long): String {
  if (total <= 0L) return "0%"
  val pct = part.toDouble() / total.toDouble() * 100.0
  return if (pct >= 10) String.format(Locale.US, "%.0f%%", pct)
  else String.format(Locale.US, "%.1f%%", pct)
}

/** Best-effort parse of hub ISO timestamps (with or without zone). */
fun parseInstant(raw: String?): Instant? {
  if (raw.isNullOrBlank()) return null
  val text = raw.trim()
  return try {
    Instant.parse(text)
  } catch (_: Exception) {
    try {
      OffsetDateTime.parse(text).toInstant()
    } catch (_: Exception) {
      try {
        LocalDateTime.parse(text).atZone(ZoneId.systemDefault()).toInstant()
      } catch (_: Exception) {
        null
      }
    }
  }
}

/** Relative label like "3 分钟前" / "2 小时后"; falls back to compact local time. */
fun formatRelativeTime(raw: String?, now: Instant = Instant.now()): String {
  val instant = parseInstant(raw) ?: return raw?.takeIf { it.isNotBlank() } ?: "未知"
  val seconds = Duration.between(instant, now).seconds
  val absSec = abs(seconds)
  val future = seconds < 0
  val label = when {
    absSec < 45 -> "刚刚"
    absSec < 90 -> "1 分钟"
    absSec < 3600 -> "${absSec / 60} 分钟"
    absSec < 5400 -> "1 小时"
    absSec < 86400 -> "${absSec / 3600} 小时"
    absSec < 172800 -> "1 天"
    absSec < 86400 * 30 -> "${absSec / 86400} 天"
    else -> {
      return LocalDateTime.ofInstant(instant, ZoneId.systemDefault()).format(shortDateTime)
    }
  }
  if (label == "刚刚") return label
  return if (future) "${label}后" else "${label}前"
}

fun formatIsoCompact(raw: String?): String {
  val instant = parseInstant(raw) ?: return raw?.takeIf { it.isNotBlank() } ?: "未知"
  return LocalDateTime.ofInstant(instant, ZoneId.systemDefault()).format(shortDateTime)
}

data class ShareEntry(
  val key: String,
  val tokens: Long,
  val costUsd: Double = 0.0
)

fun topShareEntries(
  tokens: Map<String, Long>,
  costs: Map<String, Double> = emptyMap(),
  limit: Int = 6
): List<ShareEntry> {
  if (tokens.isEmpty()) return emptyList()
  val sorted = tokens.entries.sortedByDescending { it.value }
  if (sorted.size <= limit) {
    return sorted.map { ShareEntry(it.key, it.value, costs[it.key] ?: 0.0) }
  }
  val head = sorted.take(limit - 1)
  val rest = sorted.drop(limit - 1)
  val otherTokens = rest.sumOf { it.value }
  val otherCost = rest.sumOf { costs[it.key] ?: 0.0 }
  return head.map { ShareEntry(it.key, it.value, costs[it.key] ?: 0.0) } +
    ShareEntry("其他", otherTokens, otherCost)
}


fun devicePlatformLabel(
  platform: String?,
  osName: String? = null,
  osVersion: String? = null
): String {
  val base = when {
    platform.isNullOrBlank() -> ""
    platform.contains("darwin", true) || platform.contains("mac", true) -> "macOS"
    platform.contains("win", true) -> "Windows"
    platform.contains("linux", true) -> "Linux"
    else -> platform
  }
  val name = osName?.trim().orEmpty().ifBlank { base }
  val version = osVersion?.trim().orEmpty()
  return listOf(name, version).filter { it.isNotBlank() }.joinToString(" ").ifBlank { "—" }
}

fun countActiveDays(
  daily: List<HistoryDayDto>,
  window: String = "all"
): Int {
  var days = daily
  if (window == "year" && days.isNotEmpty()) {
    val cutoff = java.time.LocalDate.now(java.time.ZoneOffset.UTC).minusDays(365).toString()
    days = days.filter { it.date >= cutoff }
  }
  return days.count { it.tokens > 0.0 || it.cost > 0.0 }
}

fun heatmapValue(day: HistoryDayDto, metric: String = "tokens"): Double {
  return if (metric == "cost") kotlin.math.max(0.0, day.cost) else kotlin.math.max(0.0, day.tokens)
}

fun agentRuntimeLabel(runtime: String?): String {
  val raw = runtime?.trim().orEmpty()
  if (raw.isEmpty()) return ""
  val value = raw.lowercase()
  return when {
    value == "widget" || value.contains("electron") || value.contains("widget") -> "widget"
    value.contains("headless") || value == "agent" -> "headless-agent"
    value.contains("embedded") -> "legacy"
    else -> raw
  }
}

fun clientStatusLabel(state: String?): String = when (state?.trim()?.lowercase()) {
  "active" -> "活跃"
  "waiting" -> "等待"
  "missing" -> "未发现"
  else -> state.orEmpty()
}

fun wslStatusLabel(state: String?): String = when (state?.trim()?.lowercase()) {
  "active" -> "活跃"
  "no-data" -> "无数据"
  "not-running" -> "未运行"
  "not-installed" -> "未安装"
  "disabled" -> "已禁用"
  else -> state.orEmpty()
}

fun formatMoneyAmount(amount: Double?, currency: String? = null): String {
  if (amount == null || !amount.isFinite()) return "—"
  val cur = currency?.trim().orEmpty()
  val body = if (kotlin.math.abs(amount) >= 100) {
    String.format(java.util.Locale.US, "%.0f", amount)
  } else {
    String.format(java.util.Locale.US, "%.2f", amount)
  }
  return if (cur.isBlank()) body else "$body $cur"
}

fun limitPlanLabel(provider: com.igng.tokenmonitor.android.data.model.LimitProviderDto): String {
  val planLabel = provider.planLabel?.trim().orEmpty()
  if (planLabel.isNotEmpty()) return planLabel
  val plan = provider.plan?.trim().orEmpty().ifEmpty { provider.planType?.trim().orEmpty() }
  if (plan.isNotEmpty()) return plan
  val email = provider.accountEmail?.trim().orEmpty()
  val label = provider.accountLabel?.trim().orEmpty()
  if (email.isNotEmpty() && label.isNotEmpty() && !label.equals(email, ignoreCase = true)) return label
  return ""
}

fun limitAccountDisplayName(
  provider: com.igng.tokenmonitor.android.data.model.LimitProviderDto,
  peers: List<com.igng.tokenmonitor.android.data.model.LimitProviderDto> = emptyList()
): String {
  val id = provider.provider.trim().lowercase()
  val email = provider.accountEmail?.trim().orEmpty()
  val accountName = provider.accountName?.trim().orEmpty()
  val accountLabel = provider.accountLabel?.trim().orEmpty()
  val workspace = accountName.ifEmpty {
    if (provider.workspaceKind?.trim().equals("personal", ignoreCase = true)) "个人" else ""
  }
  if (id == "codex") {
    if (email.isNotEmpty() && workspace.isNotEmpty()) {
      val sameEmail = peers.count {
        it.accountEmail?.trim().orEmpty().equals(email, ignoreCase = true)
      } > 1
      return if (sameEmail) "$email · $workspace" else email
    }
    return email.ifEmpty { workspace.ifEmpty { accountLabel.ifEmpty { "Codex" } } }
  }
  return accountName.ifEmpty {
    accountLabel.ifEmpty {
      email.ifEmpty { id.ifEmpty { "账户" } }
    }
  }
}

/**
 * Connection label for a device row.
 *
 * `stale` alone is not enough: the Hub keeps a snapshot for `staleAfterMs`
 * (10 minutes by default), so a device that stopped reporting still reads "在线"
 * for that whole window, and a device whose every client reports `missing` reads
 * online too. The backend already publishes the per-client truth in
 * `clientStatus`, so use it.
 */
fun deviceConnectionLabel(stale: Boolean, clientStatus: Map<String, String>?): String {
  if (stale) return "离线"
  val states = clientStatus.orEmpty().values.map { it.trim().lowercase() }.filter { it.isNotEmpty() }
  return when {
    states.isEmpty() -> "在线"
    states.all { it == "missing" } -> "未发现客户端"
    states.any { it == "active" } -> "在线"
    states.any { it == "waiting" } -> "等待活动"
    else -> "在线"
  }
}

/** True when a device should count as online in the fleet summary. */
fun deviceCountsAsOnline(stale: Boolean, clientStatus: Map<String, String>?): Boolean =
  !stale && deviceConnectionLabel(stale, clientStatus) == "在线"
