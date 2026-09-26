package com.igng.tokenmonitor.android.ui.components

import com.igng.tokenmonitor.android.ui.components.FluentIcons
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Icon
import androidx.compose.ui.res.painterResource
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.igng.tokenmonitor.android.data.model.LimitProviderDto
import com.igng.tokenmonitor.android.data.model.LimitWindowDto
import com.igng.tokenmonitor.android.data.model.LimitsDto
import com.igng.tokenmonitor.android.ui.theme.FluentMotion
import com.igng.tokenmonitor.android.ui.theme.FluentShapeDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentSpacingDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentTypeRamp
import com.igng.tokenmonitor.android.ui.theme.LocalFluentColors
import java.util.Locale
import kotlin.math.min

private val providerLabels = mapOf(
  "claude" to "Claude",
  "codex" to "Codex",
  "cursor" to "Cursor",
  "antigravity" to "Antigravity",
  "opencode" to "OpenCode",
  "deepseek" to "DeepSeek",
  "minimax" to "MiniMax",
  "mimo" to "MiMo",
  "grok" to "Grok",
  "copilot" to "Copilot",
  "kiro" to "Kiro",
  "zai" to "Z.ai",
  "zaiteam" to "Z.ai Team",
  "volcengine" to "Volcengine",
  "qoder" to "Qoder",
  "openrouter" to "OpenRouter",
  "kimi" to "Kimi",
  "ollama" to "Ollama"
)

fun providerDisplayName(id: String): String =
  providerLabels[id.lowercase(Locale.US)] ?: id.replaceFirstChar {
    if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString()
  }

fun windowKindLabel(kind: String): String = when (kind.lowercase(Locale.US)) {
  "session" -> "会话"
  "weekly" -> "每周"
  "billing" -> "账期"
  // The shared schema also has `named` (a labelled allowance) and `credits`;
  // without these the row printed the raw English enum token.
  "named" -> "额度"
  "credits" -> "积分"
  else -> kind
}

fun findUrgentLimit(limits: LimitsDto?): Pair<LimitProviderDto, Double>? {
  val providers = limits?.providers.orEmpty()
  var mostUrgent: Pair<LimitProviderDto, Double>? = null
  for (provider in providers) {
    val meterWindows = provider.windows.filter { it.showMeter && windowUsedPercent(it) != null }
    val headlineUsed = meterWindows.mapNotNull { windowUsedPercent(it) }.maxOrNull() ?: continue
    val remaining = (100.0 - headlineUsed).coerceIn(0.0, 100.0)
    if (remaining <= 25.0) {
      if (mostUrgent == null || remaining < mostUrgent.second) {
        mostUrgent = Pair(provider, remaining)
      }
    }
  }
  return mostUrgent
}

@Composable
fun UrgentLimitAlertBar(
  provider: LimitProviderDto,
  remainingPercent: Double,
  onClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val colors = LocalFluentColors.current
  val isExhausted = remainingPercent <= 0.0
  val bg = if (isExhausted) colors.errorBackground else colors.warningBackground
  val fg = if (isExhausted) colors.errorForeground else colors.warningForeground
  val text = if (isExhausted) {
    "${providerDisplayName(provider.provider)} 额度已用尽"
  } else {
    "${providerDisplayName(provider.provider)} 额度告急，仅剩 ${String.format(Locale.US, "%.0f%%", remainingPercent)}"
  }

  Row(
    modifier
      .fillMaxWidth()
      .clip(FluentShapeDefaults.cardCorner)
      .background(bg)
      .border(0.5.dp, fg.copy(alpha = 0.35f), FluentShapeDefaults.cardCorner)
      .clickable(onClick = onClick)
      .padding(horizontal = FluentSpacingDefaults.l, vertical = FluentSpacingDefaults.s),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.SpaceBetween
  ) {
    Row(
      Modifier.weight(1f),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.s)
    ) {
      Icon(
        painter = painterResource(FluentIcons.AlertBadge),
        contentDescription = null,
        tint = fg,
        modifier = Modifier.size(16.dp)
      )
      Text(
        text,
        style = FluentTypeRamp.caption1,
        fontWeight = FontWeight.SemiBold,
        color = fg,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
    }
    Text(
      "查看",
      style = FluentTypeRamp.caption2,
      fontWeight = FontWeight.SemiBold,
      color = fg
    )
  }
}

// ─── Section ────────────────────────────────────────────────────────────────
//
// Fluent treats a limit as *utilisation*, so every account row carries a real
// progress bar plus a text status label — colour alone never states the fact
// (WCAG 1.4.1).  Homogeneous accounts share one card surface (`FluentCardList`)
// separated by hairlines instead of each getting its own Material card, and the
// per-window detail expands in place on Fluent's standard curve.

@Composable
fun LimitsSection(
  limits: LimitsDto?,
  modifier: Modifier = Modifier,
  title: String = "AI 工具限额",
  includeAllProviders: Boolean = false,
  maxAccounts: Int? = null
) {
  val raw = limits?.providers.orEmpty()
  val filtered = if (includeAllProviders) {
    raw
  } else {
    raw.filter { provider ->
      provider.windows.any { it.showMeter && windowUsedPercent(it) != null } ||
        provider.balanceUsd != null ||
        provider.balance?.amount != null ||
        provider.resetCredits != null ||
        !provider.status.isNullOrBlank()
    }
  }
  val providers = if (maxAccounts != null) filtered.take(maxAccounts.coerceIn(1, 12)) else filtered
  if (providers.isEmpty()) return

  // Row expansion is presentation-only state, so it survives refresh frames.
  // A lone account opens itself: with nothing to scan against, a collapsed row
  // would hide the entire payload of the section.
  var expandedKeys by remember {
    mutableStateOf(
      if (providers.size == 1) setOf(limitRowKey(providers.first(), 0)) else emptySet<String>()
    )
  }

  FluentCardList(modifier = modifier) {
    Column(
      Modifier
        .fillMaxWidth()
        .padding(
          start = FluentSpacingDefaults.l,
          end = FluentSpacingDefaults.l,
          top = FluentSpacingDefaults.m,
          bottom = FluentSpacingDefaults.s
        )
    ) {
      SectionHeader(
        title = title,
        subtitle = limits?.updatedAt?.let { "更新 ${formatRelativeTime(it)}" } ?: "来自 Hub 聚合"
      )
    }
    providers.forEachIndexed { index, provider ->
      val key = limitRowKey(provider, index)
      val peers = providers.filter {
        it.provider.trim().equals(provider.provider.trim(), ignoreCase = true)
      }
      // index + 1 so the first account is also separated from the header block.
      LimitAccountRow(
        provider = provider,
        peers = peers,
        expanded = key in expandedKeys,
        dividerAbove = true,
        onToggle = {
          expandedKeys = if (key in expandedKeys) expandedKeys - key else expandedKeys + key
        }
      )
    }
  }
}

private fun limitRowKey(provider: LimitProviderDto, index: Int): String =
  provider.accountKey?.takeIf { it.isNotBlank() }
    ?: "${provider.provider.trim().lowercase(Locale.US)}|${provider.accountEmail.orEmpty()}" +
      "|${provider.accountLabel.orEmpty()}|$index"

@Composable
private fun LimitAccountRow(
  provider: LimitProviderDto,
  peers: List<LimitProviderDto>,
  expanded: Boolean,
  dividerAbove: Boolean,
  onToggle: () -> Unit
) {
  val colors = LocalFluentColors.current
  val displayName = limitAccountDisplayName(provider, peers)
  val meta = buildList {
    add(providerDisplayName(provider.provider))
    limitPlanLabel(provider).takeIf { it.isNotBlank() }?.let { add(it) }
    provider.source?.takeIf { it.isNotBlank() }?.let { add(it.uppercase(Locale.US)) }
    provider.accountEmail
      ?.takeIf { it.isNotBlank() && it != displayName }
      ?.let { add(it) }
    provider.status?.takeIf { it.isNotBlank() }?.let { add(it) }
  }.joinToString(" · ")

  // `showMeter == false` means the account deliberately hides the window;
  // `windowUsedPercent == null` means the provider never told us.  Those are
  // different facts and stay different here.
  val meterWindows = provider.windows.filter { it.showMeter && windowUsedPercent(it) != null }
  val unavailableWindows = provider.windows.filter { it.showMeter && windowUsedPercent(it) == null }
  val headlineUsed = meterWindows.mapNotNull { windowUsedPercent(it) }.maxOrNull()
  val headlineRemaining = headlineUsed?.let { (100.0 - it).coerceIn(0.0, 100.0) }
  val status = limitStatus(headlineRemaining)
  val balanceLines = limitBalanceLines(provider)

  Column(Modifier.fillMaxWidth()) {
    FluentListRow(
      primary = displayName,
      secondary = meta.ifBlank { null },
      tertiary = balanceLines.firstOrNull(),
      leading = { ClientMonogram(provider.provider, size = 32.dp) },
      dividerAbove = dividerAbove,
      trailingPrimary = headlineRemaining?.let { String.format(Locale.US, "%.0f%%", it) },
      trailingSecondary = if (headlineRemaining != null) "剩余" else null,
      trailing = {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.xs)
        ) {
          LimitStatusChip(status)
          LimitExpander(expanded)
        }
      },
      onClick = onToggle
    )
    AnimatedVisibility(
      visible = expanded,
      enter = expandVertically(
        animationSpec = tween(FluentMotion.normal, easing = FluentMotion.standard)
      ) + fadeIn(tween(FluentMotion.normal, easing = FluentMotion.standard)),
      exit = shrinkVertically(
        animationSpec = tween(FluentMotion.normal, easing = FluentMotion.standard)
      ) + fadeOut(tween(FluentMotion.fast, easing = FluentMotion.accelerate))
    ) {
      Column(
        Modifier
          .fillMaxWidth()
          .background(colors.neutralLayerInner)
          .padding(
            start = FluentSpacingDefaults.l,
            end = FluentSpacingDefaults.l,
            top = FluentSpacingDefaults.s,
            bottom = FluentSpacingDefaults.m
          ),
        verticalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.m)
      ) {
        balanceLines.forEach { line ->
          Text(
            line,
            style = FluentTypeRamp.caption1,
            color = colors.neutralForeground2
          )
        }

        meterWindows.take(3).forEach { window ->
          LimitWindowBar(window)
        }

        val unavailableLabels = unavailableWindows
          .map { window -> window.label?.takeIf { it.isNotBlank() } ?: windowKindLabel(window.kind) }
          .distinct()
          .joinToString("、")
        if (unavailableLabels.isNotBlank()) {
          Text(
            "$unavailableLabels · 未知",
            style = FluentTypeRamp.caption1,
            color = colors.neutralForeground3
          )
        }

        provider.windows
          .mapNotNull { window -> window.detail?.takeIf { it.isNotBlank() } }
          .distinct()
          .forEach { detail ->
            Text(
              detail,
              style = FluentTypeRamp.caption2,
              color = colors.neutralForeground2,
              maxLines = 2,
              overflow = TextOverflow.Ellipsis
            )
          }
      }
    }
  }
}

private fun limitBalanceLines(provider: LimitProviderDto): List<String> = buildList {
  provider.balanceUsd?.let { add("USD 余额 " + formatMoneyAmount(it, "USD")) }
  provider.balance?.let { balance ->
    balance.amount?.let { amount ->
      add("余额 " + formatMoneyAmount(amount, balance.currency))
    }
    balance.todaySpend?.let { spend ->
      add("今日消耗 " + formatMoneyAmount(spend, balance.currency))
    }
    balance.weekSpend?.let { spend ->
      add("本周消耗 " + formatMoneyAmount(spend, balance.currency))
    }
    balance.monthSpend?.let { spend ->
      add("本月消耗 " + formatMoneyAmount(spend, balance.currency))
    }
    balance.allTimeSpend?.let { spend ->
      add("累计消耗 " + formatMoneyAmount(spend, balance.currency))
    }
  }
  val credits = provider.resetCredits
  if (credits != null) {
    val available = credits.availableCount ?: credits.available ?: credits.remaining
    val total = credits.totalCount ?: credits.total ?: credits.limit
    if (available != null || total != null) {
      val body = buildString {
        if (available != null) append(available.toInt())
        if (total != null) {
          if (isNotEmpty()) append(" / ")
          append(total.toInt())
        }
      }
      add("重置额度 $body")
    }
  }
}

// ─── Utilisation ────────────────────────────────────────────────────────────

/**
 * One limit window as a Fluent progress row: label and reset hint on the lead,
 * the remaining figure and its text status on the trail, a 4dp bar underneath.
 */
@Composable
private fun LimitWindowBar(
  window: LimitWindowDto,
  modifier: Modifier = Modifier
) {
  val colors = LocalFluentColors.current
  val used = windowUsedPercent(window) ?: return
  val remaining = (100.0 - used).coerceIn(0.0, 100.0)
  val status = limitStatus(remaining)
  val fill by animateColorAsState(
    targetValue = status.accent,
    animationSpec = tween(FluentMotion.normal, easing = FluentMotion.standard),
    label = "limitBarFill"
  )
  val fraction = animateGrowFraction(
    target = (used / 100f).toFloat(),
    durationMillis = FluentMotion.slow
  )

  Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.xs)) {
    Row(
      Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column(Modifier.weight(1f)) {
        Text(
          buildString {
            append(window.label?.takeIf { it.isNotBlank() } ?: windowKindLabel(window.kind))
            if (window.metric?.equals("credits", ignoreCase = true) == true) append(" · 积分")
          },
          style = FluentTypeRamp.body2,
          color = colors.neutralForeground1,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis
        )
        window.resetsAt?.let {
          Text(
            "重置 ${formatRelativeTime(it)}",
            style = FluentTypeRamp.caption2,
            color = colors.neutralForeground3,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
        }
      }
      Spacer(Modifier.width(FluentSpacingDefaults.m))
      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.xs)
      ) {
        Text(
          "剩余 " + String.format(Locale.US, "%.0f%%", remaining),
          style = FluentTypeRamp.body2,
          fontWeight = FontWeight.SemiBold,
          color = status.accent,
          maxLines = 1
        )
        Text(
          status.label,
          style = FluentTypeRamp.caption2,
          color = status.accent,
          maxLines = 1
        )
      }
    }
    QuotaBar(fraction = fraction, color = fill)
  }
}

/**
 * Fluent progress: a 4dp track on `neutralBackground3` with squared
 * (`controlCorner`) ends — Material's full pill reads as decoration here, while
 * Fluent's bar is a measurement.
 */
@Composable
private fun QuotaBar(
  fraction: Float,
  color: Color,
  modifier: Modifier = Modifier
) {
  val colors = LocalFluentColors.current
  Box(
    modifier
      .fillMaxWidth()
      .height(4.dp)
      .clip(FluentShapeDefaults.controlCorner)
      .background(colors.neutralForeground3.copy(alpha = 0.18f))
  ) {
    Box(
      Modifier
        .fillMaxWidth(fraction.coerceIn(0f, 1f))
        .height(4.dp)
        .background(color, FluentShapeDefaults.controlCorner)
    )
  }
}

/**
 * Status alias resolution.  `errorForeground` is reserved for a spent quota;
 * "approaching the limit" is a warning, which is Fluent's own mapping and keeps
 * red meaningful in a list that is otherwise red/green for good/bad.
 */
@Composable
private fun limitStatus(remainingPercent: Double?): LimitStatus {
  val colors = LocalFluentColors.current
  return when (limitRemainingTone(remainingPercent)) {
    LimitRemainingTone.Unknown -> LimitStatus(
      label = "未知",
      accent = colors.neutralForeground3,
      tint = colors.neutralForeground3.copy(alpha = 0.18f)
    )
    LimitRemainingTone.Ok -> LimitStatus(
      label = "充裕",
      accent = colors.successForeground,
      tint = colors.successBackground
    )
    LimitRemainingTone.Warn -> LimitStatus(
      label = "接近上限",
      accent = colors.warningForeground,
      tint = colors.warningBackground
    )
    LimitRemainingTone.Critical -> if ((remainingPercent ?: 0.0) <= 0.0) {
      LimitStatus(
        label = "已用尽",
        accent = colors.errorForeground,
        tint = colors.errorBackground
      )
    } else {
      LimitStatus(
        label = "即将用尽",
        accent = colors.warningForeground,
        tint = colors.warningBackground
      )
    }
  }
}

private class LimitStatus(
  val label: String,
  val accent: Color,
  val tint: Color
)

/** Tinted badge carrying the status *word* next to its colour. */
@Composable
private fun LimitStatusChip(status: LimitStatus, modifier: Modifier = Modifier) {
  val accent by animateColorAsState(
    targetValue = status.accent,
    animationSpec = tween(FluentMotion.normal, easing = FluentMotion.standard),
    label = "limitChipAccent"
  )
  val tint by animateColorAsState(
    targetValue = status.tint,
    animationSpec = tween(FluentMotion.normal, easing = FluentMotion.standard),
    label = "limitChipTint"
  )
  Row(
    modifier
      .clip(FluentShapeDefaults.controlCorner)
      .background(tint)
      .border(0.5.dp, accent.copy(alpha = 0.35f), FluentShapeDefaults.controlCorner)
      .padding(horizontal = FluentSpacingDefaults.s, vertical = FluentSpacingDefaults.xxs),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.xs)
  ) {
    Box(
      Modifier
        .size(6.dp)
        .clip(FluentShapeDefaults.smallCorner)
        .background(accent)
    )
    Text(
      status.label,
      style = FluentTypeRamp.caption2,
      fontWeight = FontWeight.SemiBold,
      color = accent,
      maxLines = 1
    )
  }
}

@Composable
private fun LimitExpander(expanded: Boolean, modifier: Modifier = Modifier) {
  val colors = LocalFluentColors.current
  val rotation by animateFloatAsState(
    targetValue = if (expanded) 180f else 0f,
    animationSpec = tween(FluentMotion.normal, easing = FluentMotion.standard),
    label = "limitExpander"
  )
  Icon(
        painter = painterResource(FluentIcons.ChevronDown),
    contentDescription = if (expanded) "收起账户明细" else "展开账户明细",
    modifier = modifier
      .size(20.dp)
      .rotate(rotation),
    tint = colors.neutralForeground3
  )
}

/**
 * Ring variant of the utilisation read-out.  The section itself now uses
 * [QuotaBar]; this stays published for surfaces that need a compact radial
 * gauge, retokenised to the Fluent aliases.
 */

enum class LimitRemainingTone { Ok, Warn, Critical, Unknown }

/** Desktop-aligned remaining thresholds: <20 critical, <50 warn. */
fun limitRemainingTone(remainingPercent: Double?): LimitRemainingTone {
  if (remainingPercent == null || remainingPercent.isNaN()) return LimitRemainingTone.Unknown
  val value = remainingPercent
  return when {
    value < 20.0 -> LimitRemainingTone.Critical
    value < 50.0 -> LimitRemainingTone.Warn
    else -> LimitRemainingTone.Ok
  }
}

fun windowUsedPercent(window: LimitWindowDto): Double? {
  window.usedPercent?.let { return it.coerceIn(0.0, 100.0) }
  val used = window.used
  val limit = window.limit
  if (used != null && limit != null && limit > 0) {
    return min(100.0, (used / limit) * 100.0)
  }
  window.remainingPercent?.let { return (100.0 - it).coerceIn(0.0, 100.0) }
  return null
}
