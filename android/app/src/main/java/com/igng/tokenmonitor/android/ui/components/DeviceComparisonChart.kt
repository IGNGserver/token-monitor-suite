package com.igng.tokenmonitor.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.igng.tokenmonitor.android.data.model.DeviceDto
import com.igng.tokenmonitor.android.ui.theme.FluentChartPalette
import com.igng.tokenmonitor.android.ui.theme.FluentMotion
import com.igng.tokenmonitor.android.ui.theme.FluentShapeDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentSpacingDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentTypeRamp
import com.igng.tokenmonitor.android.ui.theme.LocalFluentColors

data class DeviceShare(
  val id: String,
  val name: String,
  val tokens: Long,
  val costUsd: Double,
  val stale: Boolean
)

fun devicesToShares(devices: List<DeviceDto>, limit: Int = 8): List<DeviceShare> {
  return devices
    .sortedWith(compareByDescending<DeviceDto> { it.periods.today.totalTokens }.thenBy { it.stale })
    .take(limit)
    .map {
      DeviceShare(
        id = it.deviceId.orEmpty(),
        name = it.hostname?.takeIf { n -> n.isNotBlank() } ?: it.deviceId.orEmpty().ifBlank { "设备" },
        tokens = it.periods.today.totalTokens,
        costUsd = it.periods.today.costUsd,
        stale = it.stale
      )
    }
}

/**
 * Cross-device comparison.
 *
 * Fluent ranks by *ordering and weight* rather than by colouring each bar
 * differently: the leader is emphasised with `title3`/SemiBold and the accent
 * fill, and the rest recede to a single neutral-series hue.  Giving every device
 * its own colour (as the previous version did) spent the colour budget on
 * identity that the label already carries.
 */
@Composable
fun DeviceComparisonChart(
  devices: List<DeviceDto>,
  modifier: Modifier = Modifier,
  limit: Int = 8,
  showCost: Boolean = true
) {
  val colors = LocalFluentColors.current
  val shares = devicesToShares(devices, limit)
  if (shares.isEmpty()) return
  val maxTokens = shares.maxOf { it.tokens }.coerceAtLeast(1L)
  val leaderColor = colors.brandForeground1
  val followerColor = FluentChartPalette[0].copy(alpha = 0.55f)
  val staleColor = colors.neutralStroke2

  Column(
    modifier = modifier.fillMaxWidth(),
    verticalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.m)
  ) {
    shares.forEachIndexed { index, share ->
      val targetFraction = (share.tokens.toFloat() / maxTokens.toFloat()).coerceIn(0.02f, 1f)
      val fraction = animateGrowFraction(targetFraction, durationMillis = FluentMotion.slow)
      val isLeader = index == 0 && !share.stale
      val barColor = when {
        share.stale -> staleColor
        isLeader -> leaderColor
        else -> followerColor
      }
      Row(
        Modifier
          .fillMaxWidth()
          .semantics {
            contentDescription =
              "${share.name}，今日 ${formatTokensShort(share.tokens)} token" +
                if (share.stale) "，已离线" else ""
          },
        verticalAlignment = Alignment.CenterVertically
      ) {
        StatusDot(active = !share.stale, size = 6.dp)
        Spacer(Modifier.width(FluentSpacingDefaults.s))
        Column(Modifier.weight(1f)) {
          Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text(
              share.name,
              style = if (isLeader) FluentTypeRamp.title3 else FluentTypeRamp.body2,
              fontWeight = if (isLeader) FontWeight.SemiBold else FontWeight.Normal,
              color = if (share.stale) colors.neutralForeground3 else colors.neutralForeground1,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
              modifier = Modifier.weight(1f, fill = false)
            )
            Spacer(Modifier.width(FluentSpacingDefaults.s))
            Text(
              formatTokensShort(share.tokens),
              style = FluentTypeRamp.caption1,
              fontWeight = FontWeight.SemiBold,
              color = if (share.stale) colors.neutralForeground3 else colors.neutralForeground2
            )
            if (showCost) {
              Spacer(Modifier.width(FluentSpacingDefaults.s))
              Text(
                formatUsd(share.costUsd, compact = true),
                style = FluentTypeRamp.caption2,
                color = colors.neutralForeground3
              )
            }
          }
          Spacer(Modifier.height(FluentSpacingDefaults.xs))
          // Inline track so the comparison bar is directly under its label.
          androidx.compose.foundation.Canvas(
            Modifier
              .fillMaxWidth()
              .height(4.dp)
          ) {
            val h = size.height
            val r = androidx.compose.ui.geometry.CornerRadius(2.dp.toPx(), 2.dp.toPx())
            drawRoundRect(color = colors.neutralForeground3.copy(alpha = 0.18f), cornerRadius = r)
            drawRoundRect(
              color = barColor,
              size = androidx.compose.ui.geometry.Size(
                (size.width * fraction).coerceAtLeast(h),
                h
              ),
              cornerRadius = r
            )
          }
        }
      }
    }
  }
}

@Composable
fun MiniDeviceBars(
  devices: List<DeviceDto>,
  modifier: Modifier = Modifier,
  limit: Int = 5
) {
  DeviceComparisonChart(devices = devices, modifier = modifier, limit = limit, showCost = false)
}
