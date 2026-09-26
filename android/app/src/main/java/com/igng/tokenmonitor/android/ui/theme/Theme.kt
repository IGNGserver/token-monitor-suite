package com.igng.tokenmonitor.android.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape
import com.igng.tokenmonitor.android.data.local.ThemeMode
import com.igng.tokenmonitor.android.data.local.ThemeSeedId

// ─── Fluent 2 → Material 3 bridge ──────────────────────────────────────────
//
// We keep MaterialTheme as the Compose plumbing layer (the handful of M3
// primitives still used here read from it) but feed it Fluent 2 token values,
// and *only* values that already exist in `FluentColorTokens`:
//   • MaterialTheme.colorScheme.* → Fluent alias colours
//   • MaterialTheme.typography.*  → Fluent type-ramp styles
//   • MaterialTheme.shapes.*      → Fluent corner radii
//
// Nothing in this file may carry a colour literal.  `FluentColorTokens` is the
// single place hex lives, because that is the place
// `npm run verify:android-fluent-contrast` measures; a hex here would be an
// unmeasured colour shipping to users.
//
// Components that need Fluent-specific tokens (e.g. brandBackgroundHover,
// neutralStroke3, focus rings) read LocalFluentColors.current directly, and that
// is the path every first-party component is expected to use.

// ─── Colour mapping ─────────────────────────────────────────────────────────

/**
 * Map Fluent aliases onto the M3 roles that library components still consume.
 *
 * Material's tonal `secondaryContainer`/`tertiaryContainer` have no Fluent
 * counterpart (Fluent layers by elevation, not by tint), so they take the
 * accent container — a real Fluent pair whose contrast the guard measures —
 * rather than an invented one.  Roles Fluent genuinely has no answer for
 * (`surfaceBright`/`surfaceDim`/`*Fixed`) are intentionally left at their M3
 * defaults: no first-party component reads them, and inventing a value would
 * put an unmeasured colour in front of users.
 */
private fun FluentColorTokens.toMaterialScheme(isDark: Boolean): ColorScheme {
  val neutral = if (isDark) {
    darkColorScheme(
      primary = brandBackground,
      onPrimary = foregroundOnAccent,
      primaryContainer = brandContainer,
      onPrimaryContainer = brandContainerForeground,
      secondary = brandForeground1,
      onSecondary = neutralBackground1,
      secondaryContainer = brandContainer,
      onSecondaryContainer = brandContainerForeground,
      tertiary = brandForeground2,
      onTertiary = neutralBackground1,
      tertiaryContainer = brandContainer,
      onTertiaryContainer = brandContainerForeground,
      error = errorForeground,
      onError = neutralBackground1,
      errorContainer = errorBackground,
      onErrorContainer = errorForegroundOnSubtle,
      background = neutralBackground1,
      onBackground = neutralForeground1,
      surface = neutralBackground1,
      onSurface = neutralForeground1,
      surfaceVariant = neutralLayerInner,
      onSurfaceVariant = neutralForeground2,
      surfaceContainerLowest = neutralBackground2,
      surfaceContainerLow = surfaceCard,
      surfaceContainer = surfaceCardContainer,
      surfaceContainerHigh = neutralLayerInner,
      surfaceContainerHighest = neutralBackground2,
      outline = neutralStroke1,
      outlineVariant = neutralStroke3,
      scrim = scrim,
      surfaceTint = brandBackground
    )
  } else {
    lightColorScheme(
      primary = brandBackground,
      onPrimary = foregroundOnAccent,
      primaryContainer = brandContainer,
      onPrimaryContainer = brandContainerForeground,
      secondary = brandForeground1,
      onSecondary = neutralBackground1,
      secondaryContainer = brandContainer,
      onSecondaryContainer = brandContainerForeground,
      tertiary = brandForeground2,
      onTertiary = neutralBackground1,
      tertiaryContainer = brandContainer,
      onTertiaryContainer = brandContainerForeground,
      error = errorForeground,
      onError = neutralBackground1,
      errorContainer = errorBackground,
      onErrorContainer = errorForegroundOnSubtle,
      background = neutralBackground1,
      onBackground = neutralForeground1,
      surface = neutralBackground1,
      onSurface = neutralForeground1,
      surfaceVariant = neutralLayerInner,
      onSurfaceVariant = neutralForeground2,
      surfaceContainerLowest = neutralBackground2,
      surfaceContainerLow = surfaceCard,
      surfaceContainer = surfaceCardContainer,
      surfaceContainerHigh = neutralLayerInner,
      surfaceContainerHighest = neutralBackground2,
      outline = neutralStroke1,
      outlineVariant = neutralStroke3,
      scrim = scrim,
      surfaceTint = brandBackground
    )
  }
  return neutral.copy(inverseSurface = inverseBackground, inverseOnSurface = inverseForeground)
}

// ─── Typography mapping ─────────────────────────────────────────────────────

/**
 * Map the Fluent ramp onto M3's type roles.
 *
 * The two systems are not 1:1, so this table is a *ceiling*, not an equivalence:
 * M3 role names must never be used as design guidance in screens.  `body1` and
 * `body2` are the same 14/20 style, and both `subtitle` and `title3` are 16/22
 * differing only in weight — so `bodyLarge` vs `bodyMedium` carries no meaning
 * here while `FluentTypeRamp.body1` vs `body2` does.  Screens read the Fluent
 * ramp directly (asserted by `npm run verify:android-fluent-boundary`).
 */
private fun FluentTypography.toMaterialTypography(): Typography {
  return Typography(
    displayLarge = display,
    displayMedium = largeTitle,
    displaySmall = title1,
    headlineLarge = title1,
    headlineMedium = title2,
    headlineSmall = title3,
    titleLarge = title2,
    titleMedium = subtitle,
    titleSmall = title3,
    bodyLarge = body1,
    bodyMedium = body2,
    bodySmall = caption1,
    labelLarge = subtitle,
    labelMedium = caption1,
    labelSmall = caption2
  )
}

// ─── Shape mapping ──────────────────────────────────────────────────────────

/**
 * M3 exposes five shape slots and no `full`; note that Material's own
 * `ButtonDefaults.shape` resolves through a shape *token* path
 * (`FilledButtonTokens.ContainerShape`) that this table cannot override.  That
 * is one more reason no first-party button may be an M3 button — see
 * `FluentFilledButton` / `FluentSubtleButton`.
 */
private fun FluentShapes.toMaterialShapes(): androidx.compose.material3.Shapes {
  return androidx.compose.material3.Shapes(
    extraSmall = smallCorner,
    small = controlCorner,
    medium = cardCorner,
    large = largeCorner,
    extraLarge = largeCorner
  )
}

// ─── Brand seed resolution ──────────────────────────────────────────────────

private fun resolveBrandSeed(themeSeed: ThemeSeedId): FluentBrandSeed? {
  val id = when (themeSeed) {
    ThemeSeedId.System -> null   // system = default blue, or wallpaper accent on 12+
    ThemeSeedId.Blue -> "blue"
    ThemeSeedId.Green -> "green"
    ThemeSeedId.Purple -> "purple"
    ThemeSeedId.Teal -> "teal"
    ThemeSeedId.Orange -> "orange"
    ThemeSeedId.Rose -> "rose"
  }
  return id?.let { FluentBrandSeeds.firstOrNull { s -> s.id == it } }
}

/**
 * Swatch shown on the theme picker.  Every non-`System` entry is read back out of
 * [FluentBrandSeeds] so the picker cannot advertise a hue the theme does not
 * apply; `System` is a neutral, because it means "follow the platform" rather
 * than a colour of its own.
 */
fun themeSeedSwatch(id: ThemeSeedId): Color {
  if (id == ThemeSeedId.System) return FluentPalette.neutral40
  val seed = FluentBrandSeeds.firstOrNull { it.id == id.name.lowercase() }
  return seed?.swatch ?: FluentPalette.brand100
}

// ─── Theme entry point ──────────────────────────────────────────────────────

@Composable
fun TokenMonitorTheme(
  themeSeed: ThemeSeedId = ThemeSeedId.System,
  themeMode: ThemeMode = ThemeMode.System,
  content: @Composable () -> Unit
) {
  val dark = when (themeMode) {
    ThemeMode.Light -> false
    ThemeMode.Dark -> true
    ThemeMode.System -> isSystemInDarkTheme()
  }
  val context = LocalContext.current

  // Resolve the Fluent alias set first, because it — not MaterialTheme — is what
  // every first-party component paints with.  Under `System` on Android 12+ the
  // wallpaper colour is allowed to move the *accent only*: the dynamic primary
  // contributes its hue and saturation, and each accent role keeps the luminance
  // the guard measured.  MaterialTheme is then derived from the same alias set,
  // so the two layers can never disagree about what the accent is.
  val dynamicSeedColor = if (
    themeSeed == ThemeSeedId.System && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
  ) {
    (if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)).primary
  } else {
    null
  }

  val fluentColors = remember(themeSeed, dark, dynamicSeedColor) {
    val seeded = resolveBrandSeed(themeSeed)
      ?.let { brandTokensForSeed(it, dark) }
      ?: if (dark) FluentDarkColors else FluentLightColors
    if (dynamicSeedColor != null) {
      dynamicAccentTokens(seeded, dynamicSeedColor, dark)
    } else {
      seeded
    }
  }

  val materialScheme = remember(fluentColors, dark) {
    fluentColors.toMaterialScheme(dark)
  }

  val typography = remember { FluentTypeRamp.toMaterialTypography() }
  val shapes = remember { FluentShapeDefaults.toMaterialShapes() }

  val adaptation = rememberFluentAdaptation()
  CompositionLocalProvider(
    LocalFluentColors provides fluentColors,
    LocalFluentAdaptation provides adaptation,
    // M3 primitives resolve `LocalContentColor` from `colorScheme.onSurface`;
    // pin it to the Fluent alias so the inherited text colour is identical to
    // the one first-party components set explicitly.
    androidx.compose.material3.LocalContentColor provides fluentColors.neutralForeground1
  ) {
    MaterialTheme(
      colorScheme = materialScheme,
      typography = typography,
      shapes = shapes,
      content = content
    )
  }
}
