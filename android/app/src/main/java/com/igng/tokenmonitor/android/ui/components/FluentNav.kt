package com.igng.tokenmonitor.android.ui.components

import com.igng.tokenmonitor.android.ui.components.FluentIcons
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.annotation.DrawableRes
import androidx.compose.material3.Icon
import androidx.compose.ui.res.painterResource
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.igng.tokenmonitor.android.ui.theme.FluentMotion
import com.igng.tokenmonitor.android.ui.theme.FluentSpacingDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentTypeRamp
import com.igng.tokenmonitor.android.ui.theme.LocalFluentAdaptation
import com.igng.tokenmonitor.android.ui.theme.LocalFluentColors

/**
 * Fluent 2 destination record for the shell.
 *
 * Fluent uses *outlined* glyphs at rest and promotes the selected item to its
 * filled variant.  This app only ships one variant per destination, so the
 * selection signal is carried by colour, weight and the underline instead.
 */
data class FluentDestination(
  val route: String,
  val label: String,
  @DrawableRes val icon: Int
)

object FluentDestinations {
  val all = listOf(
    FluentDestination("overview", "总览", FluentIcons.Home),
    FluentDestination("analytics", "分析", FluentIcons.Poll),
    FluentDestination("devices", "设备", FluentIcons.PhoneLaptop),
    FluentDestination("more", "更多", FluentIcons.Apps)
  )
  val routes: Set<String> = all.map { it.route }.toSet()
}

/**
 * Fluent 2 bottom global-navigation bar.
 *
 * Deliberate departures from Material 3's `NavigationBar`:
 *   • no pill "active indicator" behind the icon — Fluent marks selection with a
 *     2px underline plus brand foreground, keeping the icon grid undisturbed;
 *   • no tonal container: the bar is the same surface as the page, separated
 *     only by a hairline, because Fluent layers by stroke at the app-chrome edge;
 *   • labels always visible (Fluent does not collapse labels for unselected
 *     destinations, since a collapsed label costs recognition).
 */
@Composable
fun FluentNavBar(
  destinations: List<FluentDestination>,
  currentRoute: String?,
  onSelect: (FluentDestination) -> Unit,
  modifier: Modifier = Modifier
) {
  val colors = LocalFluentColors.current
  Column(
    modifier
      .fillMaxWidth()
      .background(colors.neutralBackground1)
      .navigationBarsPadding()
  ) {
    Box(
      Modifier
        .fillMaxWidth()
        .height(0.5.dp)
        .background(colors.neutralStroke2)
    )
    Row(
      Modifier
        .fillMaxWidth()
        // min, not fixed — the label under each glyph has to be able to grow.
        .heightIn(min = if (LocalFluentAdaptation.current.isLargeFont) 72.dp else 56.dp)
        .padding(horizontal = FluentSpacingDefaults.xs),
      horizontalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.xxs)
    ) {
      destinations.forEach { destination ->
        val selected = currentRoute == destination.route
        Box(Modifier.weight(1f)) {
          FluentNavItem(
            destination = destination,
            selected = selected,
            onClick = { onSelect(destination) },
            modifier = Modifier.fillMaxWidth()
          )
        }
      }
    }
  }
}

@Composable
private fun FluentNavItem(
  destination: FluentDestination,
  selected: Boolean,
  onClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val colors = LocalFluentColors.current
  val interaction = remember { MutableInteractionSource() }
  val tint by animateColorAsState(
    targetValue = if (selected) colors.brandForeground1 else colors.neutralForeground2,
    animationSpec = tween(FluentMotion.normal, easing = FluentMotion.standard),
    label = "navTint"
  )
  Column(
    modifier
      .clip(RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp))
      .clickable(
        interactionSource = interaction,
        indication = null,
        role = Role.Tab,
        onClick = onClick
      )
      .height(56.dp)
      .padding(vertical = FluentSpacingDefaults.s),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.SpaceBetween
  ) {
    Icon(
      painter = painterResource(destination.icon),
      contentDescription = null,
      modifier = Modifier.size(22.dp),
      tint = tint
    )
    Text(
      destination.label,
      style = FluentTypeRamp.caption2,
      fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
      fontSize = 12.sp, // FluentTypeRamp.caption2 is 10, caption1 is 12

      color = tint,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis
    )
  }
}

/**
 * Fluent 2 navigation rail — the tablet / landscape counterpart of
 * [FluentNavBar].  Same selection grammar (brand foreground + underline), just
 * rotated onto the leading edge where the extra width belongs.
 */
@Composable
fun FluentNavRail(
  destinations: List<FluentDestination>,
  currentRoute: String?,
  onSelect: (FluentDestination) -> Unit,
  modifier: Modifier = Modifier
) {
  val colors = LocalFluentColors.current
  Column(
    modifier
      .width(84.dp)
      .background(colors.neutralBackground2)
      .padding(vertical = FluentSpacingDefaults.l),
    verticalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.xs),
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    destinations.forEach { destination ->
      val selected = currentRoute == destination.route
      val tint = if (selected) colors.brandForeground1 else colors.neutralForeground2
      val interaction = remember { MutableInteractionSource() }
      Column(
        Modifier
          .width(72.dp)
          .clip(FluentShape())
          .clickable(interactionSource = interaction, indication = null, role = Role.Tab) {
            onSelect(destination)
          }
          .padding(vertical = FluentSpacingDefaults.m),
        horizontalAlignment = Alignment.CenterHorizontally
      ) {
        Box(contentAlignment = Alignment.CenterStart) {
          if (selected) {
            Box(
              Modifier
                .width(2.5.dp)
                .height(20.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(colors.brandForeground1)
            )
          }
          Spacer(Modifier.width(28.dp))
          Icon(
            painter = painterResource(destination.icon),
            contentDescription = null,
            modifier = Modifier.size(22.dp),
            tint = tint
          )
        }
        Spacer(Modifier.height(FluentSpacingDefaults.xs))
        Text(
          destination.label,
          style = FluentTypeRamp.caption2,
          fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
          color = tint,
          maxLines = 1
        )
      }
    }
  }
}

@Composable
private fun FluentShape() = RoundedCornerShape(4.dp)
