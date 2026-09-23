package com.igng.tokenmonitor.android.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import com.igng.tokenmonitor.android.data.local.ThemeSeedId

private data class SeedPalette(
  val lightPrimary: Color,
  val lightOnPrimary: Color,
  val lightPrimaryContainer: Color,
  val lightOnPrimaryContainer: Color,
  val lightSecondary: Color,
  val lightSecondaryContainer: Color,
  val lightOnSecondaryContainer: Color,
  val lightTertiary: Color,
  val lightTertiaryContainer: Color,
  val darkPrimary: Color,
  val darkOnPrimary: Color,
  val darkPrimaryContainer: Color,
  val darkOnPrimaryContainer: Color,
  val darkSecondary: Color,
  val darkSecondaryContainer: Color,
  val darkOnSecondaryContainer: Color,
  val darkTertiary: Color,
  val darkTertiaryContainer: Color
)

private val BlueSeed = SeedPalette(
  lightPrimary = Color(0xFF0F6CBD),
  lightOnPrimary = Color(0xFFFFFFFF),
  lightPrimaryContainer = Color(0xFFD6EBFF),
  lightOnPrimaryContainer = Color(0xFF0C3B5E),
  lightSecondary = Color(0xFF424242),
  lightSecondaryContainer = Color(0xFFF0F0F0),
  lightOnSecondaryContainer = Color(0xFF242424),
  lightTertiary = Color(0xFF6E5676),
  lightTertiaryContainer = Color(0xFFF7D8FF),
  darkPrimary = Color(0xFF479EF5),
  darkOnPrimary = Color(0xFF003258),
  darkPrimaryContainer = Color(0xFF004578),
  darkOnPrimaryContainer = Color(0xFFD6EBFF),
  darkSecondary = Color(0xFFD6D6D6),
  darkSecondaryContainer = Color(0xFF3D3D3D),
  darkOnSecondaryContainer = Color(0xFFF0F0F0),
  darkTertiary = Color(0xFFDABCE2),
  darkTertiaryContainer = Color(0xFF553F5D)
)

private val GreenSeed = SeedPalette(
  lightPrimary = Color(0xFF0F7B4A),
  lightOnPrimary = Color(0xFFFFFFFF),
  lightPrimaryContainer = Color(0xFFA7F3C8),
  lightOnPrimaryContainer = Color(0xFF002112),
  lightSecondary = Color(0xFF4F6354),
  lightSecondaryContainer = Color(0xFFD1E8D5),
  lightOnSecondaryContainer = Color(0xFF0C1F14),
  lightTertiary = Color(0xFF3B6470),
  lightTertiaryContainer = Color(0xFFBFE9F7),
  darkPrimary = Color(0xFF8BD8AD),
  darkOnPrimary = Color(0xFF003920),
  darkPrimaryContainer = Color(0xFF005231),
  darkOnPrimaryContainer = Color(0xFFA7F3C8),
  darkSecondary = Color(0xFFB5CCBA),
  darkSecondaryContainer = Color(0xFF374B3D),
  darkOnSecondaryContainer = Color(0xFFD1E8D5),
  darkTertiary = Color(0xFFA3CDDB),
  darkTertiaryContainer = Color(0xFF214C58)
)

private val PurpleSeed = SeedPalette(
  lightPrimary = Color(0xFF6B4EFF),
  lightOnPrimary = Color(0xFFFFFFFF),
  lightPrimaryContainer = Color(0xFFE6DEFF),
  lightOnPrimaryContainer = Color(0xFF1C0062),
  lightSecondary = Color(0xFF615B71),
  lightSecondaryContainer = Color(0xFFE7DEF8),
  lightOnSecondaryContainer = Color(0xFF1D192B),
  lightTertiary = Color(0xFF7D5260),
  lightTertiaryContainer = Color(0xFFFFD8E4),
  darkPrimary = Color(0xFFCABEFF),
  darkOnPrimary = Color(0xFF32009A),
  darkPrimaryContainer = Color(0xFF4A27E0),
  darkOnPrimaryContainer = Color(0xFFE6DEFF),
  darkSecondary = Color(0xFFCBC3DC),
  darkSecondaryContainer = Color(0xFF494458),
  darkOnSecondaryContainer = Color(0xFFE7DEF8),
  darkTertiary = Color(0xFFEFB8C8),
  darkTertiaryContainer = Color(0xFF633B48)
)

private val TealSeed = SeedPalette(
  lightPrimary = Color(0xFF006A6A),
  lightOnPrimary = Color(0xFFFFFFFF),
  lightPrimaryContainer = Color(0xFF6FF7F6),
  lightOnPrimaryContainer = Color(0xFF002020),
  lightSecondary = Color(0xFF4A6363),
  lightSecondaryContainer = Color(0xFFCCE8E7),
  lightOnSecondaryContainer = Color(0xFF051F1F),
  lightTertiary = Color(0xFF4B607C),
  lightTertiaryContainer = Color(0xFFD3E4FF),
  darkPrimary = Color(0xFF4CDADA),
  darkOnPrimary = Color(0xFF003737),
  darkPrimaryContainer = Color(0xFF004F4F),
  darkOnPrimaryContainer = Color(0xFF6FF7F6),
  darkSecondary = Color(0xFFB0CCCB),
  darkSecondaryContainer = Color(0xFF324B4B),
  darkOnSecondaryContainer = Color(0xFFCCE8E7),
  darkTertiary = Color(0xFFB3C8E8),
  darkTertiaryContainer = Color(0xFF334863)
)

private val OrangeSeed = SeedPalette(
  lightPrimary = Color(0xFF9A4600),
  lightOnPrimary = Color(0xFFFFFFFF),
  lightPrimaryContainer = Color(0xFFFFDCC6),
  lightOnPrimaryContainer = Color(0xFF311300),
  lightSecondary = Color(0xFF755846),
  lightSecondaryContainer = Color(0xFFFFDCC6),
  lightOnSecondaryContainer = Color(0xFF2B1708),
  lightTertiary = Color(0xFF5F6135),
  lightTertiaryContainer = Color(0xFFE4E6AE),
  darkPrimary = Color(0xFFFFB786),
  darkOnPrimary = Color(0xFF522300),
  darkPrimaryContainer = Color(0xFF753400),
  darkOnPrimaryContainer = Color(0xFFFFDCC6),
  darkSecondary = Color(0xFFE5BFA8),
  darkSecondaryContainer = Color(0xFF5B4130),
  darkOnSecondaryContainer = Color(0xFFFFDCC6),
  darkTertiary = Color(0xFFC8CA94),
  darkTertiaryContainer = Color(0xFF47491F)
)

private val RoseSeed = SeedPalette(
  lightPrimary = Color(0xFFB01363),
  lightOnPrimary = Color(0xFFFFFFFF),
  lightPrimaryContainer = Color(0xFFFFD9E2),
  lightOnPrimaryContainer = Color(0xFF3E001D),
  lightSecondary = Color(0xFF74565F),
  lightSecondaryContainer = Color(0xFFFFD9E2),
  lightOnSecondaryContainer = Color(0xFF2B151C),
  lightTertiary = Color(0xFF7C5635),
  lightTertiaryContainer = Color(0xFFFFDCC2),
  darkPrimary = Color(0xFFFFB1C8),
  darkOnPrimary = Color(0xFF650033),
  darkPrimaryContainer = Color(0xFF8E004A),
  darkOnPrimaryContainer = Color(0xFFFFD9E2),
  darkSecondary = Color(0xFFE3BDC6),
  darkSecondaryContainer = Color(0xFF5A3F47),
  darkOnSecondaryContainer = Color(0xFFFFD9E2),
  darkTertiary = Color(0xFFEFBD94),
  darkTertiaryContainer = Color(0xFF613F20)
)

private fun SeedPalette.toLightScheme(): ColorScheme = lightColorScheme(
  primary = lightPrimary,
  onPrimary = lightOnPrimary,
  primaryContainer = lightPrimaryContainer,
  onPrimaryContainer = lightOnPrimaryContainer,
  secondary = lightSecondary,
  onSecondary = Color(0xFFFFFFFF),
  secondaryContainer = lightSecondaryContainer,
  onSecondaryContainer = lightOnSecondaryContainer,
  tertiary = lightTertiary,
  onTertiary = Color(0xFFFFFFFF),
  tertiaryContainer = lightTertiaryContainer,
  onTertiaryContainer = Color(0xFF1A1C1E),
  error = md_theme_light_error,
  onError = md_theme_light_onError,
  errorContainer = md_theme_light_errorContainer,
  onErrorContainer = md_theme_light_onErrorContainer,
  background = md_theme_light_background,
  onBackground = md_theme_light_onBackground,
  surface = md_theme_light_surface,
  onSurface = md_theme_light_onSurface,
  surfaceVariant = md_theme_light_surfaceVariant,
  onSurfaceVariant = md_theme_light_onSurfaceVariant,
  outline = md_theme_light_outline,
  outlineVariant = md_theme_light_outlineVariant,
  inverseSurface = md_theme_light_inverseSurface,
  inverseOnSurface = md_theme_light_inverseOnSurface,
  inversePrimary = darkPrimary,
  surfaceTint = lightPrimary,
  scrim = md_theme_light_scrim
)

private fun SeedPalette.toDarkScheme(): ColorScheme = darkColorScheme(
  primary = darkPrimary,
  onPrimary = darkOnPrimary,
  primaryContainer = darkPrimaryContainer,
  onPrimaryContainer = darkOnPrimaryContainer,
  secondary = darkSecondary,
  onSecondary = Color(0xFF1A1C1E),
  secondaryContainer = darkSecondaryContainer,
  onSecondaryContainer = darkOnSecondaryContainer,
  tertiary = darkTertiary,
  onTertiary = Color(0xFF1A1C1E),
  tertiaryContainer = darkTertiaryContainer,
  onTertiaryContainer = Color(0xFFE2E2E9),
  error = md_theme_dark_error,
  onError = md_theme_dark_onError,
  errorContainer = md_theme_dark_errorContainer,
  onErrorContainer = md_theme_dark_onErrorContainer,
  background = md_theme_dark_background,
  onBackground = md_theme_dark_onBackground,
  surface = md_theme_dark_surface,
  onSurface = md_theme_dark_onSurface,
  surfaceVariant = md_theme_dark_surfaceVariant,
  onSurfaceVariant = md_theme_dark_onSurfaceVariant,
  outline = md_theme_dark_outline,
  outlineVariant = md_theme_dark_outlineVariant,
  inverseSurface = md_theme_dark_inverseSurface,
  inverseOnSurface = md_theme_dark_inverseOnSurface,
  inversePrimary = lightPrimary,
  surfaceTint = darkPrimary,
  scrim = md_theme_dark_scrim
)

private fun seedPalette(id: ThemeSeedId): SeedPalette = when (id) {
  ThemeSeedId.System, ThemeSeedId.Blue -> BlueSeed
  ThemeSeedId.Green -> GreenSeed
  ThemeSeedId.Purple -> PurpleSeed
  ThemeSeedId.Teal -> TealSeed
  ThemeSeedId.Orange -> OrangeSeed
  ThemeSeedId.Rose -> RoseSeed
}

/** Swatch color shown on the theme picker chip. */
fun themeSeedSwatch(id: ThemeSeedId): Color = when (id) {
  ThemeSeedId.System -> Color(0xFF607D8B)
  ThemeSeedId.Blue -> BlueSeed.lightPrimary
  ThemeSeedId.Green -> GreenSeed.lightPrimary
  ThemeSeedId.Purple -> PurpleSeed.lightPrimary
  ThemeSeedId.Teal -> TealSeed.lightPrimary
  ThemeSeedId.Orange -> OrangeSeed.lightPrimary
  ThemeSeedId.Rose -> RoseSeed.lightPrimary
}

@Composable
fun TokenMonitorTheme(
  themeSeed: ThemeSeedId = ThemeSeedId.System,
  content: @Composable () -> Unit
) {
  val dark = isSystemInDarkTheme()
  val context = LocalContext.current
  val colorScheme = when {
    themeSeed == ThemeSeedId.System && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
      if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    }
    else -> {
      val palette = seedPalette(if (themeSeed == ThemeSeedId.System) ThemeSeedId.Blue else themeSeed)
      if (dark) palette.toDarkScheme() else palette.toLightScheme()
    }
  }

  MaterialTheme(
    colorScheme = colorScheme,
    typography = TokenMonitorTypography,
    shapes = TokenMonitorShapes,
    content = content
  )
}
