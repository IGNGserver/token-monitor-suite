package com.igng.tokenmonitor.android.ui.theme

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically

// ─── Fluent 2 motion tokens ─────────────────────────────────────────────────
//
// Durations and curves are the official `duration*` / `curve*` web tokens.
// Two rules from the spec shape everything below:
//
//   1. An arriving element is always slower than a leaving one.  A screen that
//      exits in 150ms and enters in 250ms reads as settling; symmetric timing
//      reads as bouncing.
//   2. Direction encodes hierarchy.  Lateral motion is for siblings (tab
//      switches), vertical for depth (push/pop), scale for modality.  Reusing
//      one grammar for both makes a tab switch feel like a drill-in.

object FluentMotion {
  const val ultraFast = 50     // durationUltraFast — micro feedback
  const val faster = 100       // durationFaster
  const val fast = 150         // durationFast — exits, collapse
  const val normal = 200       // durationNormal — default
  const val gentle = 250       // durationGentle
  const val slow = 300         // durationSlow
  const val slower = 400       // durationSlower
  const val ultraSlow = 500    // durationUltraSlow

  // curveDecelerateMid — entering
  val decelerate: Easing = CubicBezierEasing(0f, 0f, 0f, 1f)
  // curveAccelerateMid — exiting
  val accelerate: Easing = CubicBezierEasing(1f, 0f, 1f, 1f)
  // curveEasyEaseMax — in-place property change
  val standard: Easing = CubicBezierEasing(0.8f, 0f, 0.2f, 1f)
  // curveDecelerateMax — large / hero entrance
  val max: Easing = CubicBezierEasing(0.1f, 0.9f, 0.2f, 1f)
  // curveEasyEase — the gentler general-purpose curve
  val easyEase: Easing = CubicBezierEasing(0.33f, 0f, 0.67f, 1f)

  // Travel is a fraction of the container so it scales with window width.
  const val pageTravelFraction = 0.22f
  const val microTravelFraction = 0.06f

  const val listItemStagger = 30
  const val listItemMaxStaggered = 8
}

private fun enterFade(duration: Int) =
  fadeIn(animationSpec = tween(duration, easing = FluentMotion.decelerate))

private fun exitFade(duration: Int) =
  fadeOut(animationSpec = tween(duration, easing = FluentMotion.accelerate))

// ─── Siblings: tab switches travel laterally ────────────────────────────────

fun fluentTabEnter(): EnterTransition = slideInHorizontally(
  animationSpec = tween(FluentMotion.normal, easing = FluentMotion.decelerate),
  initialOffsetX = { (it * FluentMotion.microTravelFraction).toInt() }
) + enterFade(FluentMotion.normal)

fun fluentTabExit(): ExitTransition = slideOutHorizontally(
  animationSpec = tween(FluentMotion.fast, easing = FluentMotion.accelerate),
  targetOffsetX = { (-it * FluentMotion.microTravelFraction).toInt() }
) + exitFade(FluentMotion.fast)

// ─── Depth: push and pop travel vertically, asymmetric timing ───────────────

fun fluentContentPushEnter(): EnterTransition = slideInVertically(
  animationSpec = tween(FluentMotion.gentle, easing = FluentMotion.max),
  initialOffsetY = { (it * FluentMotion.pageTravelFraction).toInt() }
) + enterFade(FluentMotion.gentle)

fun fluentContentPushExit(): ExitTransition = slideOutVertically(
  animationSpec = tween(FluentMotion.fast, easing = FluentMotion.accelerate),
  targetOffsetY = { (-it * FluentMotion.microTravelFraction).toInt() }
) + exitFade(FluentMotion.fast)

fun fluentContentPopEnter(): EnterTransition = slideInVertically(
  animationSpec = tween(FluentMotion.normal, easing = FluentMotion.decelerate),
  initialOffsetY = { (-it * FluentMotion.microTravelFraction).toInt() }
) + enterFade(FluentMotion.normal)

fun fluentContentPopExit(): ExitTransition = slideOutVertically(
  animationSpec = tween(FluentMotion.gentle, easing = FluentMotion.accelerate),
  targetOffsetY = { (it * FluentMotion.pageTravelFraction).toInt() }
) + exitFade(FluentMotion.gentle)
