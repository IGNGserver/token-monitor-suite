package com.igng.tokenmonitor.android.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import com.igng.tokenmonitor.android.ui.theme.FluentMotion
import com.igng.tokenmonitor.android.ui.theme.fluentMotionEnabled

// ─── Fluent 2 data-motion helpers ───────────────────────────────────────────
//
// Fluent's rule for data is that a value already on screen must never restart
// from zero when it merely *changes* — that reads as the data being lost. Only
// an element's first reveal earns a grow-in. The two helpers below split those
// cases explicitly, and both ease on Fluent curves (decelerate for arrival,
// standard for in-place property change).

/**
 * Interpolates toward [target] from whatever fraction is currently shown.
 * Use for values that update in place (bar widths against a changing max).
 *
 * First composition still starts at 0 so the initial paint animates in.
 */
@Composable
fun animateGrowFraction(
  target: Float,
  durationMillis: Int = FluentMotion.slow
): Float {
  val safe = target.coerceIn(0f, 1f)
  if (!fluentMotionEnabled()) return safe
  val animatable = remember { Animatable(0f) }
  LaunchedEffect(safe) {
    animatable.animateTo(
      targetValue = safe,
      animationSpec = tween(durationMillis, easing = FluentMotion.standard)
    )
  }
  return animatable.value
}

/**
 * Replays a full 0→1 sweep whenever [resetKey] changes.
 *
 * Reserved for the case where the *set itself* changes — a period switch swaps
 * which slices exist, so there is no meaningful "previous value" to interpolate
 * from and replaying the reveal is the honest choice.
 */
@Composable
fun animateGrowProgress(
  resetKey: Any?,
  durationMillis: Int = FluentMotion.slower
): Float {
  if (!fluentMotionEnabled()) return 1f
  val animatable = remember { Animatable(0f) }
  LaunchedEffect(resetKey) {
    animatable.snapTo(0f)
    animatable.animateTo(
      targetValue = 1f,
      animationSpec = tween(durationMillis, easing = FluentMotion.decelerate)
    )
  }
  return animatable.value
}

/**
 * Cross-fades between two numeric values, for a figure that ticks over as new
 * data arrives (a hero total, a percentage).  Returns the interpolated value.
 */
@Composable
fun animateNumeric(
  target: Long,
  durationMillis: Int = FluentMotion.slow
): Float {
  if (!fluentMotionEnabled()) return target.toFloat()
  val animatable = remember { Animatable(target.toFloat()) }
  LaunchedEffect(target) {
    animatable.animateTo(
      targetValue = target.toFloat(),
      animationSpec = tween(durationMillis, easing = FluentMotion.standard)
    )
  }
  return animatable.value
}
