package com.igng.tokenmonitor.android.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.LinearEasing
import com.igng.tokenmonitor.android.ui.theme.fluentMotionEnabled
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.igng.tokenmonitor.android.ui.theme.FluentMotion
import com.igng.tokenmonitor.android.ui.theme.FluentShapeDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentSpacingDefaults
import com.igng.tokenmonitor.android.ui.theme.LocalFluentColors

// ─── Fluent 2 loading state ─────────────────────────────────────────────────
//
// Fluent treats loading as a *layout-preserving* state: the skeleton renders the
// same geometry as the content that will replace it, so nothing shifts when the
// data lands.  Every block below mirrors a real component from
// OverviewScreen / DevicesScreen (header, hero card, metric tiles, plot well,
// list rows), and the radii + gaps come from the shape and spacing tokens rather
// than from magic numbers.

/**
 * One Fluent "cut-out" placeholder: a slot carved out of the surface ladder
 * (`neutralBackground3` → `neutralBackground2`), never an `onSurface` tint, so a
 * loading row can't be mistaken for a real row.  The two stops are adjacent
 * steps, which keeps the delta deliberately low; the hairline is what holds the
 * slot readable on a card whose own fill is `surfaceCard`.
 *
 * The sweep runs on Fluent's `standard` curve — it eases out as it leaves, which
 * is what stops the loop from reading as a Material gloss pass — on the nearest
 * documented duration token (`ultraSlow`) to the previous 1100 ms restart cycle.
 */
@Composable
fun SkeletonBox(
  modifier: Modifier = Modifier,
  height: Dp = 16.dp,
  shape: RoundedCornerShape = FluentShapeDefaults.cardCorner
) {
  val colors = LocalFluentColors.current
  val base = colors.neutralForeground3.copy(alpha = 0.12f)
  val highlight = colors.neutralForeground3.copy(alpha = 0.22f)
  // The shimmer is the loading *affordance*; with motion suppressed the bones still
  // read as loading, they just stop sweeping.  An `infiniteRepeatable` with a zero
  // duration still recomposes forever, so the branch has to skip the transition
  // rather than shorten it.
  val motion = fluentMotionEnabled()
  val shift = if (motion) {
    val transition = rememberInfiniteTransition(label = "skeleton")
    transition.animateFloat(
      initialValue = 0f,
      targetValue = 1f,
      animationSpec = infiniteRepeatable(
        animation = tween(FluentMotion.slower, easing = LinearEasing),
        repeatMode = RepeatMode.Restart
      ),
      label = "skeletonShift"
    ).value
  } else {
    0.5f
  }
  val brush = Brush.linearGradient(
    colors = listOf(base, highlight, base),
    start = Offset(shift * 400f - 200f, 0f),
    end = Offset(shift * 400f + 200f, 200f)
  )
  Box(
    modifier
      .height(height)
      .clip(shape)
      .background(brush)
      .border(0.5.dp, colors.neutralStroke3, shape)
  )
}

@Composable
fun OverviewSkeleton() {
  Column(
    Modifier
      .fillMaxWidth()
      .padding(FluentSpacingDefaults.l),
    verticalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.m)
  ) {
    // Screen header: title3 + caption1 on the leading edge, live-status chip
    // (a controlCorner tag, not a pill) trailing.
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
      Column(verticalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.s)) {
        SkeletonBox(Modifier.size(width = 120.dp, height = 24.dp))
        SkeletonBox(Modifier.size(width = 160.dp, height = 16.dp))
      }
      SkeletonBox(
        Modifier.size(width = 72.dp, height = 20.dp),
        shape = FluentShapeDefaults.controlCorner
      )
    }
    // Hero card: the display-scale read-out plus its trailing qualifier, then the
    // secondary metric strip.
    AppCard {
      SkeletonBox(Modifier.fillMaxWidth(), height = 96.dp, shape = FluentShapeDefaults.cardCorner)
      Spacer(Modifier.height(FluentSpacingDefaults.m))
      Row(horizontalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.s)) {
        repeat(3) {
          SkeletonBox(Modifier.weight(1f), height = 56.dp)
        }
      }
    }
    // Trend card: section header line + plot well.  Fluent caps corners at
    // `largeCorner`, so a nested well never out-rounds its own card.
    AppCard {
      SkeletonBox(Modifier.size(width = 100.dp, height = 22.dp))
      Spacer(Modifier.height(FluentSpacingDefaults.m))
      SkeletonBox(
        Modifier.fillMaxWidth(),
        height = 180.dp,
        shape = FluentShapeDefaults.largeCorner
      )
    }
    // Grouped list card: header + three stacked rows.
    AppCard {
      SkeletonBox(Modifier.size(width = 80.dp, height = 22.dp))
      Spacer(Modifier.height(FluentSpacingDefaults.m))
      repeat(3) {
        SkeletonBox(Modifier.fillMaxWidth(), height = 36.dp)
        Spacer(Modifier.height(FluentSpacingDefaults.s))
      }
    }
  }
}

@Composable
fun DevicesSkeleton() {
  Column(
    Modifier
      .fillMaxWidth()
      .padding(FluentSpacingDefaults.l),
    verticalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.m)
  ) {
    AppCard {
      SkeletonBox(Modifier.size(width = 120.dp, height = 22.dp))
      Spacer(Modifier.height(FluentSpacingDefaults.m))
      SkeletonBox(Modifier.fillMaxWidth(), height = 160.dp)
    }
    repeat(4) {
      AppCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
          Column(verticalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.xxs)) {
            SkeletonBox(Modifier.size(width = 140.dp, height = 20.dp))
            SkeletonBox(Modifier.size(width = 100.dp, height = 16.dp))
          }
          SkeletonBox(Modifier.size(width = 56.dp, height = 22.dp))
        }
      }
    }
  }
}
