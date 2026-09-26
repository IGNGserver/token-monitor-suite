package com.igng.tokenmonitor.android.ui.components

import com.igng.tokenmonitor.android.ui.components.FluentIcons
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyItemScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.igng.tokenmonitor.android.ui.theme.FluentMotion
import com.igng.tokenmonitor.android.ui.theme.FluentShapeDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentSpacingDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentTypeRamp
import com.igng.tokenmonitor.android.ui.theme.LocalFluentAdaptation
import com.igng.tokenmonitor.android.ui.theme.LocalFluentColors
import com.igng.tokenmonitor.android.ui.theme.fluentMotionEnabled

// ─── Fluent 2 structural layer ──────────────────────────────────────────────
//
// The previous UI mixed two unrelated header patterns: root tabs drew a bare
// padded Text, detail screens drew a Material TopAppBar.  Fluent 2 separates
// these deliberately:
//
//   • PageHeader      — the large-title header that opens a top-level page.
//                       It scrolls WITH the content (Fluent pages are
//                       "self-contained" surfaces, not bar + canvas).
//   • CommandBar/TopBar — a compact 48dp bar for task screens entered by
//                       drill-in.  Borderless at rest; it gains a hairline only
//                       once content scrolls under it, which is Fluent's rule
//                       for distinguishing "at top" from "detached".
//   • ListRow         — one canonical 48–56dp item layout used by every list in
//                       the app, replacing per-screen hand-rolled rows.

/** Minimum interactive height — Fluent mobile touch target. */
val FluentTouchMin = 48.dp

// ─── Page header (top-level tabs) ───────────────────────────────────────────

@Composable
fun FluentPageHeader(
  title: String,
  modifier: Modifier = Modifier,
  subtitle: String? = null,
  trailing: @Composable (() -> Unit)? = null
) {
  val colors = LocalFluentColors.current
  // `Scaffold.contentWindowInsets` is zeroed at the root because the bars own
  // their own insets; that is correct for the bottom nav, which calls
  // `navigationBarsPadding()`, but it meant nothing on the four root tabs applied a
  // *top* inset — only `FluentTopBar` did, and detail screens are the only ones
  // that draw it. On Android 15+ that put the page title under the status bar.
  Row(
    modifier
      .fillMaxWidth()
      .statusBarsPadding()
      .padding(
        start = FluentSpacingDefaults.l,
        end = FluentSpacingDefaults.l,
        top = FluentSpacingDefaults.l,
        bottom = FluentSpacingDefaults.s
      ),
    verticalAlignment = Alignment.CenterVertically
  ) {
    Column(Modifier.weight(1f)) {
      Text(
        title,
        style = FluentTypeRamp.largeTitle,
        color = colors.neutralForeground1,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
      if (subtitle != null) {
        Spacer(Modifier.height(FluentSpacingDefaults.xxs))
        Text(
          subtitle,
          style = FluentTypeRamp.caption1,
          color = colors.neutralForeground2,
          maxLines = 2,
          overflow = TextOverflow.Ellipsis
        )
      }
    }
    if (trailing != null) {
      Spacer(Modifier.width(FluentSpacingDefaults.s))
      trailing()
    }
  }
}

// ─── Command bar (drill-in screens) ─────────────────────────────────────────

/**
 * 48dp Fluent top bar.  [scrolled] toggles the hairline divider — pass a value
 * derived from the screen's scroll state so the bar is borderless at rest.
 */
@Composable
fun FluentTopBar(
  title: String,
  modifier: Modifier = Modifier,
  onBack: (() -> Unit)? = null,
  onHome: (() -> Unit)? = null,
  scrolled: Boolean = false,
  subtitle: String? = null,
  actions: @Composable RowScope.() -> Unit = {}
) {
  val colors = LocalFluentColors.current
  Column(
    modifier
      .fillMaxWidth()
      .background(colors.neutralBackground1)
      .statusBarsPadding()
      .then(
        if (scrolled) Modifier.border(0.5.dp, colors.neutralStroke2)
        else Modifier
      )
  ) {
    val scale = LocalFluentAdaptation.current.mediaScale
    Row(
      Modifier
        .fillMaxWidth()
        // min, not fixed: a 48 dp bar clips a 1.3× title instead of growing.
        .heightIn(min = if (scale > 1f) 56.dp else 48.dp)
        .padding(horizontal = FluentSpacingDefaults.xs),
      verticalAlignment = Alignment.CenterVertically
    ) {
      if (onBack != null) {
        FluentIconButton(
          icon = FluentIcons.ChevronLeft,
          contentDescription = "返回",
          onClick = onBack,
          tint = colors.neutralForeground1
        )
      }
      Column(
        Modifier
          .weight(1f)
          .padding(start = if (onBack != null) FluentSpacingDefaults.xs else FluentSpacingDefaults.s)
      ) {
        Text(
          title,
          style = FluentTypeRamp.title3,
          color = colors.neutralForeground1,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis
        )
        if (subtitle != null) {
          Text(
            subtitle,
            style = FluentTypeRamp.caption2,
            color = colors.neutralForeground3,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
        }
      }
      Row(
        horizontalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.xxs),
        verticalAlignment = Alignment.CenterVertically
      ) {
        if (onHome != null) {
          FluentIconButton(
            icon = FluentIcons.Home,
            contentDescription = "首页",
            onClick = onHome,
            tint = colors.neutralForeground1
          )
        }
        actions()
      }
    }
    // A 0-height border above draws nothing; keep an explicit hairline slot so
    // the bar height is stable whether or not content has scrolled.
    if (scrolled) {
      Box(
        Modifier
          .fillMaxWidth()
          .height(0.5.dp)
          .background(colors.neutralStroke2)
      )
    }
  }
}

/**
 * Derives the "content has scrolled away from the top" flag that [FluentTopBar]
 * needs, for the two scrolling containers this app actually uses.
 */
@Composable
fun rememberScrolledFlag(scrollState: androidx.compose.foundation.ScrollState): Boolean {
  return remember { derivedStateOf { scrollState.value > 4 } }.value
}

@Composable
fun rememberScrolledFlag(listState: LazyListState): Boolean {
  return remember {
    derivedStateOf {
      listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > 4
    }
  }.value
}

// ─── List row ───────────────────────────────────────────────────────────────

/**
 * Fluent 2 list item: 52dp default height, leading media slot, a primary line
 * with an optional supporting line, trailing meta, and an optional disclosure
 * chevron.  Everything that was previously hand-rolled per screen goes through
 * here so row rhythm stays uniform.
 */
@Composable
fun FluentListRow(
  primary: String,
  modifier: Modifier = Modifier,
  secondary: String? = null,
  tertiary: String? = null,
  leading: @Composable (() -> Unit)? = null,
  trailing: @Composable (() -> Unit)? = null,
  trailingPrimary: String? = null,
  trailingSecondary: String? = null,
  disclosure: Boolean = false,
  onClick: (() -> Unit)? = null,
  contentPadding: Dp = FluentSpacingDefaults.l,
  dividerAbove: Boolean = false
) {
  val colors = LocalFluentColors.current
  val interaction = remember { MutableInteractionSource() }
  val pressed by interaction.collectIsPressedAsState()
  val hovered = onClick != null && rememberFluentHover(interaction)

  val row: @Composable () -> Unit = {
    Row(
      modifier
        .fillMaxWidth()
        .background(
          when {
            pressed -> colors.subtleBackgroundPressed
            hovered -> colors.subtleBackgroundHover
            else -> colors.surfaceCard
          }
        )
        .heightIn(min = LocalFluentAdaptation.current.rowMinHeight)
        .padding(horizontal = contentPadding, vertical = FluentSpacingDefaults.m),
      verticalAlignment = Alignment.CenterVertically
    ) {
      if (leading != null) {
        leading()
        Spacer(Modifier.width(FluentSpacingDefaults.m))
      }
      Column(Modifier.weight(1f)) {
        Text(
          primary,
          style = FluentTypeRamp.body1,
          fontWeight = FontWeight.SemiBold,
          color = colors.neutralForeground1,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis
        )
        if (secondary != null) {
          Spacer(Modifier.height(FluentSpacingDefaults.xxs))
          Text(
            secondary,
            style = FluentTypeRamp.caption1,
            color = colors.neutralForeground2,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
        }
        if (tertiary != null) {
          Spacer(Modifier.height(FluentSpacingDefaults.xxs))
          Text(
            tertiary,
            style = FluentTypeRamp.caption2,
            color = colors.neutralForeground3,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
        }
      }
      if (trailingPrimary != null || trailingSecondary != null || trailing != null) {
        Spacer(Modifier.width(FluentSpacingDefaults.m))
        Column(horizontalAlignment = Alignment.End) {
          if (trailingPrimary != null) {
            Text(
              trailingPrimary,
              style = FluentTypeRamp.title3,
              color = colors.neutralForeground1,
              maxLines = 1
            )
          }
          if (trailingSecondary != null) {
            Text(
              trailingSecondary,
              style = FluentTypeRamp.caption1,
              color = colors.neutralForeground2,
              maxLines = 1
            )
          }
          trailing?.invoke()
        }
      }
      if (disclosure) {
        Spacer(Modifier.width(FluentSpacingDefaults.xs))
        DisclosureChevron()
      }
    }
  }

  Box(
    Modifier.then(
      if (onClick != null) {
        Modifier
          .hoverable(interaction)
          .clickable(
            interactionSource = interaction,
            indication = null,
            role = androidx.compose.ui.semantics.Role.Button,
            onClick = onClick
          )
      } else Modifier
    )
  ) {
    Column(Modifier.fillMaxWidth()) {
      if (dividerAbove) {
        // Hairlines start at the content edge, not the container edge: a rule
        // that runs under the leading media reads as a container seam.
        Box(
          Modifier
            .fillMaxWidth()
            .padding(start = contentPadding)
            .height(0.5.dp)
            .background(colors.neutralStroke3)
        )
      }
      row()
    }
  }
}

/**
 * A grouped collection: rows share one surface and are separated by hairlines,
 * which is how Fluent groups homogeneous lists (as opposed to Material's "every
 * item is its own card").  Rows opt into their separator with
 * `FluentListRow(dividerAbove = index > 0)`.
 */
@Composable
fun FluentCardList(
  modifier: Modifier = Modifier,
  content: @Composable ColumnScope.() -> Unit
) {
  val colors = LocalFluentColors.current
  Column(
    modifier
      .fillMaxWidth()
      .clip(FluentShapeDefaults.cardCorner)
      .background(colors.surfaceCard)
      .border(0.5.dp, colors.neutralStroke3, FluentShapeDefaults.cardCorner),
    content = content
  )
}

// ─── Filter / period selector ───────────────────────────────────────────────

/**
 * Fluent "Tab" strip used for period and metric switching.  Material's
 * FilterChip and SegmentedButton both appeared in the old UI for the same job;
 * Fluent has one answer: a horizontally scrollable row of text tabs where the
 * selection is marked by a 2px brand underline plus foreground weight.
 */
@Composable
fun FluentTabStrip(
  options: List<String>,
  selectedIndex: Int,
  onSelect: (Int) -> Unit,
  modifier: Modifier = Modifier,
  /**
   * Horizontal inset.  It used to be baked in at 16 dp, which was invisible when the
   * strip sat directly on the page and a double indent when it sat inside a card that
   * already pads by 16 dp — 13 call sites, most of them inside a card.  The owner of
   * the container decides now; screens that put the strip on the page pass
   * [FluentSpacingDefaults.l].
   */
  contentPadding: Dp = 0.dp
) {
  Row(
    modifier
      .fillMaxWidth()
      .horizontalScroll(rememberScrollState())
      .padding(horizontal = contentPadding),
    horizontalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.xl)
  ) {
    options.forEachIndexed { index, label ->
      FluentTab(
        label = label,
        selected = index == selectedIndex,
        onClick = { onSelect(index) }
      )
    }
  }
}

@Composable
private fun FluentTab(
  label: String,
  selected: Boolean,
  onClick: () -> Unit
) {
  val colors = LocalFluentColors.current
  val interaction = remember { MutableInteractionSource() }
  val pressed by interaction.collectIsPressedAsState()
  val hovered = rememberFluentHover(interaction)
  val weight = if (selected) FontWeight.SemiBold else FontWeight.Normal
  val fg by androidx.compose.animation.animateColorAsState(
    targetValue = when {
      pressed -> colors.neutralForeground1
      selected -> colors.brandForeground1
      hovered -> colors.neutralForeground1
      else -> colors.neutralForeground2
    },
    animationSpec = tween(FluentMotion.faster),
    label = "tabFg"
  )
  Column(
    Modifier
      // `selectable(role = Tab)` rather than `clickable`: the underline and the
      // semibold weight were the only thing carrying which tab was on, so the state
      // existed purely as paint.  This also gives the strip arrow-key traversal for
      // free on a keyboard / d-pad.
      .hoverable(interaction)
      .selectable(
        selected = selected,
        role = Role.Tab,
        interactionSource = interaction,
        indication = null,
        onClick = onClick
      )
      .then(
        Modifier.fluentFocusRing(
          interaction,
          FluentShapeDefaults.controlCorner,
          LocalFluentColors.current.neutralStroke1
        )
      )
      .heightIn(min = FluentTouchMin)
      .clip(FluentShapeDefaults.controlCorner)
      .background(
        when {
          pressed -> colors.subtleBackgroundPressed
          hovered -> colors.subtleBackgroundHover
          else -> androidx.compose.ui.graphics.Color.Transparent
        }
      )
      .padding(
        start = FluentSpacingDefaults.xs,
        end = FluentSpacingDefaults.xs,
        top = FluentSpacingDefaults.s,
        bottom = FluentSpacingDefaults.xs
      ),
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Text(label, style = FluentTypeRamp.body1, fontWeight = weight, color = fg)
    Spacer(Modifier.height(FluentSpacingDefaults.xs))
    AnimatedVisibility(visible = selected, enter = fadeIn(tween(FluentMotion.faster)), exit = fadeOut(tween(FluentMotion.faster))) {
      Box(
        Modifier
          .width(20.dp)
          .height(2.5.dp)
          .clip(RoundedCornerShape(2.dp))
          .background(colors.brandForeground1)
      )
    }
  }
}

// ─── Staggered list entrance ────────────────────────────────────────────────

/**
 * Fluent's list entrance: items rise into place on a deceleration curve with a
 * small per-index stagger, so a long list reads as one motion rather than many.
 */
@Composable
fun LazyItemScope.FluentStaggeredIn(
  index: Int,
  enabled: Boolean = fluentMotionEnabled(),
  content: @Composable () -> Unit
) {
  if (!enabled) {
    content()
    return
  }
  var visible by remember { androidx.compose.runtime.mutableStateOf(false) }
  androidx.compose.runtime.LaunchedEffect(Unit) { visible = true }
  androidx.compose.animation.AnimatedVisibility(
    visible = visible,
    enter = androidx.compose.animation.expandVertically(
      animationSpec = tween(
        durationMillis = FluentMotion.normal,
        delayMillis = minOf(index, 8) * FluentMotion.listItemStagger,
        easing = FluentMotion.decelerate
      )
    ) + fadeIn(
      animationSpec = tween(
        durationMillis = FluentMotion.normal,
        delayMillis = minOf(index, 8) * FluentMotion.listItemStagger,
        easing = FluentMotion.decelerate
      )
    )
  ) { content() }
}

/** Section grouping: an optional label plus content, Fluent's "group" rhythm. */
@Composable
fun FluentSection(
  modifier: Modifier = Modifier,
  title: String? = null,
  subtitle: String? = null,
  content: @Composable ColumnScope.() -> Unit
) {
  val colors = LocalFluentColors.current
  Column(modifier.fillMaxWidth()) {
    if (title != null) {
      Column(Modifier.padding(start = FluentSpacingDefaults.l, end = FluentSpacingDefaults.l, bottom = FluentSpacingDefaults.xs)) {
        Text(
          title,
          style = FluentTypeRamp.caption1,
          fontWeight = FontWeight.SemiBold,
          letterSpacing = 0.5.sp,
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
    }
    content()
  }
}
