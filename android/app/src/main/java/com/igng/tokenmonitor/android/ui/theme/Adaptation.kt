package com.igng.tokenmonitor.android.ui.theme

import android.annotation.SuppressLint
import android.content.Context
import android.provider.Settings
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// ─── Fluent 2 adaptation context ────────────────────────────────────────────
//
// Fluent 2 treats adaptation as part of the design system rather than a
// compatibility layer: the same component must come out correct for phone and
// tablet, touch and pointer, light and dark, large font, and for people who have
// asked the platform to suppress animation.  These are the signals components read.
//
// Keeping them in one object is the point: a component cannot adapt to the window
// while forgetting the font scale, which is exactly how a fixed-height row starts
// clipping text rather than reflowing it.

@Immutable
data class FluentAdaptation(
  /**
   * Window width class on the 600 / 840 dp phone · tablet · desktop ladder — the same
   * breakpoints the platform's window classes use.  It is named as that ladder rather
   * than as "Fluent's", because Fluent publishes a finer web ladder and pretending
   * otherwise is how a comment becomes a lie.
   *
   * These three flags are placeholders until the app root measures the content area;
   * see [measuredAgainst].
   */
  val isCompact: Boolean,
  val isMedium: Boolean,
  val isLarge: Boolean,
  /**
   * System font scale at or above "large".  1.3× is where the fixed heights in this
   * app (nav 56 dp, bar 48 dp, row 52 dp) start clipping rather than wrapping, so
   * components switch from `height` to `heightIn(min =)` at this flag.
   */
  val isLargeFont: Boolean,
  val fontScale: Float,
  /**
   * Whether transitions may run.  `false` when the platform animator duration scale is
   * zero, which is what the system's own reduce-motion affordance sets and the only
   * signal in the public API.  Fluent's spec is explicit that motion here is
   * decorative and must yield to that preference.
   *
   * Stated plainly because it is *not* a full reduced-motion contract: there is no
   * public per-user "reduce animations" flag to read before Android 13, so a user who
   * turned it on without the scale reaching zero is not covered.  The web/desktop
   * shared UI has the same limit and additionally exposes an explicit in-app toggle;
   * giving the client one is a separate, small piece of work, not something this flag
   * quietly does.
   */
  val motionEnabled: Boolean
) {
  /** Minimum list-row height; taller under a large font, never shorter. */
  val rowMinHeight: Dp
    get() = if (isLargeFont) 64.dp else 52.dp

  /** Leading-media scale, so icons and swatches grow with the text beside them. */
  val mediaScale: Float
    get() = if (isLargeFont) 1.25f else 1f

  /**
   * Re-classify the three width flags against a measured content width.
   *
   * The width class is not computed inside [rememberFluentAdaptation] on purpose:
   * `Configuration.screenWidthDp` reports the *display*, not the window, and the
   * documented window-bounds accessor is not reachable at this compileSdk.  The app
   * root wraps itself in `BoxWithConstraints` and calls this, which measures the real
   * content area — correct in split-screen and on a half-open foldable, with no
   * platform version dependency.  Font scale and motion stay configuration-level
   * because those genuinely are.
   */
  fun measuredAgainst(widthDp: Dp): FluentAdaptation = copy(
    isCompact = widthDp < 600.dp,
    isMedium = widthDp >= 600.dp && widthDp < 840.dp,
    isLarge = widthDp >= 840.dp
  )
}

val LocalFluentAdaptation = staticCompositionLocalOf {
  FluentAdaptation(
    isCompact = true,
    isMedium = false,
    isLarge = false,
    isLargeFont = false,
    fontScale = 1f,
    motionEnabled = true
  )
}

@SuppressLint("HardwareIds", "ReadPermissionSettings")
private fun animatorScale(context: Context): Float = runCatching {
  Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)
}.getOrElse { 1f }

@Composable
fun rememberFluentAdaptation(): FluentAdaptation {
  val context = LocalContext.current
  val configuration = LocalConfiguration.current
  val dark = isSystemInDarkTheme()
  val fontScale = configuration.fontScale
  return remember(fontScale, dark) {
    FluentAdaptation(
      isCompact = true,
      isMedium = false,
      isLarge = false,
      isLargeFont = fontScale >= 1.3f,
      fontScale = fontScale,
      motionEnabled = animatorScale(context) > 0f
    )
  }
}

/**
 * True when an animation may run.  Every call site that starts a transition gates on
 * this rather than dropping frames after the fact — a zero-length tween still
 * recomposes, which is the opposite of what suppressing motion is for.
 */
@Composable
fun fluentMotionEnabled(): Boolean = LocalFluentAdaptation.current.motionEnabled
