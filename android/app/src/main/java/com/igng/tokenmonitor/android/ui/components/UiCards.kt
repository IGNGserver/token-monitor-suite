package com.igng.tokenmonitor.android.ui.components

import com.igng.tokenmonitor.android.ui.components.FluentIcons
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.HoverInteraction
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.hoverable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.ui.res.painterResource
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.igng.tokenmonitor.android.data.model.PeriodDto
import com.igng.tokenmonitor.android.ui.RealtimeStatus
import com.igng.tokenmonitor.android.ui.components.FluentButton
import com.igng.tokenmonitor.android.ui.components.FluentButtonVariant
import com.igng.tokenmonitor.android.ui.theme.FluentElevationDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentMotion
import com.igng.tokenmonitor.android.ui.theme.FluentShapeDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentSpacingDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentTypeRamp
import com.igng.tokenmonitor.android.ui.theme.LocalFluentColors
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween

// ─── Fluent 2 surface primitives ────────────────────────────────────────────
//
// Fluent cards are quieter than Material cards: a light elevation shadow, an
// optional hairline stroke, and NO primary tint.  Depth is communicated by the
// background ladder (bg1 → bg2 → bg3) plus shadow, not by colouring surfaces.

/**
 * Fluent 2 Card.  `onClick == null` renders the resting state; otherwise the
 * surface gains a press overlay and a leading chevron affordance is left to the
 * caller (Fluent does not bake navigation chrome into the container).
 */
@Composable
fun AppCard(
  modifier: Modifier = Modifier,
  onClick: (() -> Unit)? = null,
  shape: Shape = FluentShapeDefaults.cardCorner,
  contentPadding: Dp = FluentSpacingDefaults.l,
  filled: Boolean = true,
  content: @Composable ColumnScope.() -> Unit
) {
  val colors = LocalFluentColors.current
  val interaction = remember { MutableInteractionSource() }
  val pressed by interaction.collectIsPressedAsState()

  val container = colors.surfaceCard
  val hovered = onClick != null && rememberFluentHover(interaction)
  // Fluent state layer: hover lightens, press darkens, and neither is a
  // Material ripple — the surface itself changes value.
  val pressedTint by animateColorAsState(
    targetValue = when {
      pressed -> colors.subtleBackgroundPressed
      hovered -> colors.subtleBackgroundHover
      else -> container
    },
    animationSpec = tween(FluentMotion.ultraFast),
    label = "cardPress"
  )
  val background = if (filled) pressedTint else colors.subtleBackground

  val surface = modifier
    .fillMaxWidth()
    .shadow(
      elevation = if (onClick != null) FluentElevationDefaults.level4 else FluentElevationDefaults.level2,
      shape = shape,
      clip = false
    )
    .clip(shape)
    .background(background)
    .border(0.5.dp, colors.neutralStroke3, shape)

  val body: @Composable () -> Unit = {
    Column(
      Modifier.padding(contentPadding),
      content = content
    )
  }

  if (onClick != null) {
    Box(
      surface.hoverable(interaction).clickable(
        interactionSource = interaction,
        indication = null,
        onClick = onClick
      )
    ) { body() }
  } else {
    Box(surface) { body() }
  }
}

/**
 * Header row for a card or section.  Fluent pairs a `title3` heading with a
 * `caption1` supporting line and keeps any action right-aligned and quiet.
 */
@Composable
fun SectionHeader(
  title: String,
  modifier: Modifier = Modifier,
  subtitle: String? = null,
  actionLabel: String? = null,
  onAction: (() -> Unit)? = null
) {
  val colors = LocalFluentColors.current
  Row(
    modifier = modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically
  ) {
    Column(Modifier.weight(1f)) {
      Text(
        title,
        style = FluentTypeRamp.title3,
        color = colors.neutralForeground1
      )
      if (subtitle != null) {
        Spacer(Modifier.height(FluentSpacingDefaults.xxs))
        Text(
          subtitle,
          style = FluentTypeRamp.caption1,
          color = colors.neutralForeground3
        )
      }
    }
    if (actionLabel != null && onAction != null) {
      // A quiet Fluent button rather than `TextButton`: Material's version paints a
      // circular ripple and takes its corner from a shape token the bridge cannot
      // reach, so an otherwise-Fluent card header ended with a Material pill in it.
      FluentButton(
        label = actionLabel,
        onClick = onAction,
        variant = FluentButtonVariant.Quiet
      )
    }
  }
}

/**
 * The primary metric read-out.  Fluent puts the number first at `display` and
 * demotes every qualifier, so the value is scannable at a glance.
 */
@Composable
fun MetricHeroCard(
  title: String,
  period: PeriodDto?,
  modifier: Modifier = Modifier,
  subtitle: String? = null,
  trailing: @Composable (() -> Unit)? = null
) {
  val colors = LocalFluentColors.current
  val cost = rememberCostFormatter()
  AppCard(modifier = modifier, contentPadding = FluentSpacingDefaults.xl) {
    Row(
      Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Text(
        title.uppercase(),
        style = FluentTypeRamp.caption1,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.6.sp,
        color = colors.neutralForeground3
      )
      if (subtitle != null) {
        Text(
          subtitle,
          style = FluentTypeRamp.caption2,
          color = colors.neutralForeground3
        )
      }
    }
    Spacer(Modifier.height(FluentSpacingDefaults.xs))
    Row(
      Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column(Modifier.weight(1f)) {
        Text(
          formatTokensShort(period?.totalTokens ?: 0L),
          style = FluentTypeRamp.largeTitle,
          color = colors.neutralForeground1,
          maxLines = 1
        )
        Spacer(Modifier.height(FluentSpacingDefaults.xxs))
        Text(
          formatTokens(period?.totalTokens ?: 0L),
          style = FluentTypeRamp.caption1,
          color = colors.neutralForeground3,
          maxLines = 1
        )
        Spacer(Modifier.height(FluentSpacingDefaults.s))
        Text(
          cost.format(period?.costUsd ?: 0.0),
          style = FluentTypeRamp.title3,
          color = colors.brandForeground1,
          fontWeight = FontWeight.SemiBold,
          maxLines = 1
        )
      }
      if (trailing != null) {
        Spacer(Modifier.width(FluentSpacingDefaults.m))
        Box(contentAlignment = Alignment.Center) { trailing() }
      }
    }
  }
}

/**
 * Secondary metric tile.  Fluent differentiates hierarchy through the background
 * ladder rather than an outline, so this is a filled bg2 surface.
 */
@Composable
fun CompactMetricCard(
  title: String,
  period: PeriodDto?,
  modifier: Modifier = Modifier
) {
  val colors = LocalFluentColors.current
  val cost = rememberCostFormatter()
  Column(
    modifier
      .fillMaxWidth()
      .clip(FluentShapeDefaults.cardCorner)
      .background(colors.neutralLayerInner)
      .border(0.5.dp, colors.neutralStroke3, FluentShapeDefaults.cardCorner)
      .padding(FluentSpacingDefaults.m)
  ) {
    Text(
      title.uppercase(),
      style = FluentTypeRamp.caption2,
      fontWeight = FontWeight.SemiBold,
      letterSpacing = 0.5.sp,
      color = colors.neutralForeground3
    )
    Spacer(Modifier.height(FluentSpacingDefaults.xs))
    Text(
      formatTokensShort(period?.totalTokens ?: 0L),
      style = FluentTypeRamp.title2,
      color = colors.neutralForeground1
    )
    Text(
      cost.format(period?.costUsd ?: 0.0, compact = true),
      style = FluentTypeRamp.caption1,
      color = colors.neutralForeground2
    )
  }
}

/**
 * Fluent Badge/Tag carrying a live-connection state.  A tinted background with a
 * matching foreground keeps the state legible without stealing focus from data.
 */
@Composable
fun RealtimeStatusChip(status: RealtimeStatus, modifier: Modifier = Modifier) {
  val colors = LocalFluentColors.current
  // The *_ON_SUBTLE foregrounds exist because the base hues fall below 4.5:1 on
  // their own tint — warning measures 2.83:1 in light mode.  Caption-sized text
  // cannot ride that pairing.
  val (label, tint, fg) = when (status) {
    RealtimeStatus.Live ->
      Triple("实时连接", colors.successBackground, colors.successForegroundOnSubtle)
    RealtimeStatus.Reconnecting ->
      Triple("重连中", colors.warningBackground, colors.warningForegroundOnSubtle)
    RealtimeStatus.Disconnected ->
      Triple("已断开", colors.errorBackground, colors.errorForegroundOnSubtle)
  }
  Row(
    modifier
      .clip(FluentShapeDefaults.controlCorner)
      .background(tint)
      .padding(horizontal = FluentSpacingDefaults.s, vertical = FluentSpacingDefaults.xs),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.xs)
  ) {
    Box(
      Modifier
        .size(6.dp)
        .background(fg, CircleShape)
    )
    Text(
      label,
      style = FluentTypeRamp.caption2,
      fontWeight = FontWeight.SemiBold,
      color = fg
    )
  }
}

/**
 * Fluent empty state: centred icon well, a `title3` headline, a `body2`
 * explanation, and an optional single action.
 */
@Composable
fun EmptyState(
  text: String,
  modifier: Modifier = Modifier,
  icon: Int = FluentIcons.Box,
  title: String? = null,
  actionLabel: String? = null,
  onAction: (() -> Unit)? = null
) {
  val colors = LocalFluentColors.current
  Column(
    modifier
      .fillMaxWidth()
      .padding(horizontal = FluentSpacingDefaults.xxxl, vertical = 48.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.m)
  ) {
    Box(
      modifier = Modifier
        .size(72.dp)
        .background(colors.neutralForeground3.copy(alpha = 0.12f), CircleShape),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        painter = painterResource(icon),
        contentDescription = null,
        modifier = Modifier.size(32.dp),
        tint = colors.brandForeground1
      )
    }
    if (title != null) {
      Text(
        title,
        style = FluentTypeRamp.title3,
        color = colors.neutralForeground1,
        textAlign = TextAlign.Center
      )
    }
    Text(
      text,
      style = FluentTypeRamp.body2,
      color = colors.neutralForeground2,
      textAlign = TextAlign.Center
    )
    if (actionLabel != null && onAction != null) {
      FluentButton(
        label = actionLabel,
        onClick = onAction,
        variant = FluentButtonVariant.Quiet
      )
    }
  }
}

/** Fluent status indicator — presence only, never the sole carrier of meaning. */
@Composable
fun StatusDot(active: Boolean, modifier: Modifier = Modifier, size: Dp = 8.dp) {
  val colors = LocalFluentColors.current
  Box(
    modifier
      .size(size)
      .background(
        if (active) colors.successForeground else colors.neutralStroke2,
        CircleShape
      )
  )
}

/** Right-aligned navigation chevron, sized to Fluent's 20px icon grid. */
@Composable
fun DisclosureChevron(modifier: Modifier = Modifier, tintOverride: androidx.compose.ui.graphics.Color? = null) {
  val colors = LocalFluentColors.current
  Icon(
        painter = painterResource(FluentIcons.ChevronRight),
    contentDescription = null,
    modifier = modifier.size(20.dp),
    tint = tintOverride ?: colors.neutralForeground3
  )
}

/**
 * Fluent distinguishes pointer input from touch: a hoverable surface gets a
 * quiet tint on hover, and the press tint stays reserved for actual activation.
 * Touch devices never emit hover, so this is inert there by construction.
 */
@Composable
internal fun rememberFluentHover(interaction: androidx.compose.foundation.interaction.MutableInteractionSource): Boolean {
  // No platform check is needed: a touch surface never emits a HoverInteraction,
  // so this reads false on phones by construction and lights up under a pointer.
  return interaction.collectIsHoveredAsState().value
}
