package com.igng.tokenmonitor.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.igng.tokenmonitor.android.data.model.PeriodDto
import com.igng.tokenmonitor.android.ui.RealtimeStatus
import com.igng.tokenmonitor.android.ui.theme.TokenMonitorSpacing

@Composable
fun AppCard(
  modifier: Modifier = Modifier,
  onClick: (() -> Unit)? = null,
  content: @Composable ColumnScope.() -> Unit
) {
  val colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)
  if (onClick != null) {
    Card(
      onClick = onClick,
      modifier = modifier.fillMaxWidth(),
      shape = MaterialTheme.shapes.large,
      colors = colors,
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
      content = { Column(Modifier.padding(TokenMonitorSpacing.large), content = content) }
    )
  } else {
    Card(
      modifier = modifier.fillMaxWidth(),
      shape = MaterialTheme.shapes.large,
      colors = colors,
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
      content = { Column(Modifier.padding(TokenMonitorSpacing.large), content = content) }
    )
  }
}

@Composable
fun SectionHeader(
  title: String,
  modifier: Modifier = Modifier,
  subtitle: String? = null,
  actionLabel: String? = null,
  onAction: (() -> Unit)? = null
) {
  Row(
    modifier = modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically
  ) {
    Column(Modifier.weight(1f)) {
      Text(title, style = MaterialTheme.typography.titleMedium)
      if (subtitle != null) {
        Text(
          subtitle,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
    }
    if (actionLabel != null && onAction != null) {
      TextButton(onClick = onAction) { Text(actionLabel) }
    }
  }
}

@Composable
fun MetricHeroCard(
  title: String,
  period: PeriodDto?,
  modifier: Modifier = Modifier,
  trailing: @Composable (() -> Unit)? = null
) {
  AppCard(modifier = modifier) {
    Text(
      title,
      style = MaterialTheme.typography.labelLarge,
      color = MaterialTheme.colorScheme.primary
    )
    Spacer(Modifier.height(TokenMonitorSpacing.small))
    Row(
      Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column(Modifier.weight(1f)) {
        Text(
          formatTokensShort(period?.totalTokens ?: 0L),
          style = MaterialTheme.typography.displaySmall,
          fontWeight = FontWeight.SemiBold,
          maxLines = 1
        )
        Spacer(Modifier.height(TokenMonitorSpacing.xxSmall))
        Text(
          formatTokens(period?.totalTokens ?: 0L),
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 1
        )
        Spacer(Modifier.height(TokenMonitorSpacing.xSmallNudge))
        Text(
          formatUsd(period?.costUsd ?: 0.0),
          style = MaterialTheme.typography.titleMedium,
          color = MaterialTheme.colorScheme.onSurface,
          maxLines = 1
        )
      }
      if (trailing != null) {
        Spacer(Modifier.width(TokenMonitorSpacing.small))
        // Keep the donut intrinsic-sized so the hero card does not stretch empty space.
        Box(contentAlignment = Alignment.Center) { trailing() }
      }
    }
  }
}

@Composable
fun CompactMetricCard(
  title: String,
  period: PeriodDto?,
  modifier: Modifier = Modifier
) {
  OutlinedCard(
    modifier = modifier,
    shape = MaterialTheme.shapes.medium,
    colors = CardDefaults.outlinedCardColors(
      containerColor = MaterialTheme.colorScheme.surface
    )
  ) {
    Column(Modifier.padding(TokenMonitorSpacing.medium)) {
      Text(
        title,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
      Spacer(Modifier.height(TokenMonitorSpacing.xSmallNudge))
      Text(
        formatTokensShort(period?.totalTokens ?: 0L),
        style = MaterialTheme.typography.titleLarge,
        fontWeight = FontWeight.SemiBold
      )
      Text(
        formatUsd(period?.costUsd ?: 0.0, compact = true),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
    }
  }
}

@Composable
fun RealtimeStatusChip(status: RealtimeStatus, modifier: Modifier = Modifier) {
  val (label, color) = when (status) {
    RealtimeStatus.Live -> "实时连接" to MaterialTheme.colorScheme.primary
    RealtimeStatus.Reconnecting -> "重连中" to MaterialTheme.colorScheme.tertiary
    RealtimeStatus.Disconnected -> "已断开" to MaterialTheme.colorScheme.error
  }
  AssistChip(
    onClick = {},
    modifier = modifier,
    label = { Text(label) },
    leadingIcon = {
      Box(
        Modifier
          .size(8.dp)
          .background(color, CircleShape)
      )
    },
    colors = AssistChipDefaults.assistChipColors(
      labelColor = MaterialTheme.colorScheme.onSurface,
      leadingIconContentColor = color
    )
  )
}

@Composable
fun EmptyState(
  text: String,
  modifier: Modifier = Modifier,
  icon: ImageVector = Icons.Outlined.Inbox,
  title: String? = null,
  actionLabel: String? = null,
  onAction: (() -> Unit)? = null
) {
  Column(
    modifier = modifier
      .fillMaxWidth()
      .padding(horizontal = 24.dp, vertical = 48.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(14.dp)
  ) {
    Box(
      modifier = Modifier
        .size(88.dp)
        .background(
          MaterialTheme.colorScheme.surfaceContainerHighest,
          CircleShape
        ),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        icon,
        contentDescription = null,
        modifier = Modifier.size(40.dp),
        tint = MaterialTheme.colorScheme.primary
      )
    }
    if (title != null) {
      Text(
        title,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        textAlign = TextAlign.Center
      )
    }
    Text(
      text,
      style = MaterialTheme.typography.bodyMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
      textAlign = TextAlign.Center
    )
    if (actionLabel != null && onAction != null) {
      TextButton(onClick = onAction) { Text(actionLabel) }
    }
  }
}

@Composable
fun StatusDot(active: Boolean, modifier: Modifier = Modifier) {
  val color = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline
  Box(
    modifier
      .size(8.dp)
      .background(color, CircleShape)
  )
}
