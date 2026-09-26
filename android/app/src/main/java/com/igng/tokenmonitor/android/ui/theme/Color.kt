package com.igng.tokenmonitor.android.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// ─── Fluent 2 tokens for Android ────────────────────────────────────────────
//
// The alias values below are the OFFICIAL `@fluentui/tokens` web theme, copied
// verbatim and labelled with their source token name (the same package already
// vendors into `src/shared-ui/vendor/fluent-tokens.css` via
// `npm run update:fluent-assets`).  Each alias was then measured for WCAG
// contrast; the single place where the official value is *not* used verbatim is
// marked with `// DEVIATION` and the measured reason.
//
// Precedence in this file:
//   Global   — `FluentBrandRamp`, raw per-hue steps, only used to retint the
//              accent when the user picks a different theme seed.
//   Alias    — `FluentColorTokens`, what screens and components consume.
//   Component-level values live with the component (see UiCards / FluentNav).

private fun argb(hex: String): Color {
  val v = hex.removePrefix("#").toLong(16)
  return Color(0xFF000000L or v)
}

// ─── Global: brand ramp, used only to retint `brand*` aliases per seed ──────

object FluentPalette {
  // Microsoft Blue (default seed) — mirrors the web theme's brand scale.
  val brand50  = argb("EBF3FC")
  val brand60  = argb("CFF4FA")
  val brand70  = argb("C7E0F4")
  val brand90  = argb("96C6FA")
  val brand100 = argb("0F6CBD")
  val brand110 = argb("115EA3")
  val brand120 = argb("0F548C")
  val brand130 = argb("0C3B5E")
  val brand140 = argb("0A2E4A")
  val brand150 = argb("082338")

  val neutral0   = argb("000000")
  val neutral10  = argb("242424")
  val neutral20  = argb("424242")
  val neutral30  = argb("616161")
  val neutral40  = argb("707070")
  val neutral50  = argb("999999")
  val neutral60  = argb("ADADAD")
  val neutral70  = argb("D1D1D1")
  val neutral80  = argb("E0E0E0")
  val neutral90  = argb("F0F0F0")
  val neutral95  = argb("F5F5F5")
  val neutral98  = argb("FAFAFA")
  val neutral100 = argb("FFFFFF")
}

// ─── Alias tokens ───────────────────────────────────────────────────────────

@Immutable
data class FluentColorTokens(
  // Foreground
  val neutralForeground1: Color,
  val neutralForeground2: Color,
  val neutralForeground3: Color,
  val neutralForeground4: Color,
  val neutralForegroundDisabled: Color,
  val brandForeground1: Color,
  val brandForeground2: Color,
  val errorForeground: Color,
  val successForeground: Color,
  val warningForeground: Color,
  // Status hues darkened for use on their own tinted background.  The web theme
  // already ships these as `*Foreground1` (on tint) vs `*Foreground3` (on the
  // strong fill); on Android we use Foreground1 for text and this pair for the
  // chip that also paints the tint behind it.
  val errorForegroundOnSubtle: Color,
  val successForegroundOnSubtle: Color,
  val warningForegroundOnSubtle: Color,
  val foregroundOnAccent: Color,

  // Background
  val neutralBackground1: Color,
  val neutralBackground2: Color,
  val neutralBackground3: Color,
  val neutralBackground4: Color,
  val neutralBackground5: Color,
  val neutralBackgroundDisabled: Color,
  val brandBackground: Color,
  val brandBackgroundHover: Color,
  val brandBackgroundPressed: Color,
  val brandBackgroundDisabled: Color,
  val errorBackground: Color,
  val successBackground: Color,
  val warningBackground: Color,
  val subtleBackground: Color,
  val subtleBackgroundHover: Color,
  val subtleBackgroundPressed: Color,

  // Accent containers
  //
  // Fluent has no "primary container" concept (that is Material's tonal
  // elevation), but two things still need the pair: the M3 bridge, which cannot
  // leave `primaryContainer`/`tertiaryContainer` unset without falling back to
  // Material's own purple baseline, and the quiet accent tint used behind brand
  // text on an inverse surface.  Both are therefore derived from the brand ramp
  // rather than hand-picked, so a theme seed retints them and MS Blue can never
  // leak through a green/rose/purple selection.
  val brandContainer: Color,
  val brandContainerForeground: Color,
  /** The brand accent as it must read on [inverseBackground]. */
  val brandOnInverse: Color,

  // Stroke
  // `neutralStroke1` is the *accessible* stroke (focus ring, input border,
  // selection, "today" marker) and is the only one held to 3:1.  Stroke2/3 are
  // decorative grouping hairlines.
  val neutralStroke1: Color,
  val neutralStroke2: Color,
  val neutralStroke3: Color,
  val neutralStrokeDisabled: Color,
  val brandStroke: Color,
  val errorStroke: Color,

  // Surfaces
  val surfaceCard: Color,
  val surfaceCardContainer: Color,
  val surfaceFlyout: Color,
  /**
   * A quiet tile *inside* a card — stat tiles, progress tracks, empty-state
   * wells.  It cannot reuse the background ladder: `surfaceCard` is the page
   * colour (Fluent separates cards by elevation, not tint), so `bg2`/`bg3` get
   * *darker* than the card in dark mode and read as holes punched in it.
   * This alias is the one that always steps away from the card in both themes.
   */
  val neutralLayerInner: Color,

  // Inverse (toasts / snackbars)
  val inverseBackground: Color,
  val inverseForeground: Color,

  val scrim: Color
)

val FluentLightColors = FluentColorTokens(
  neutralForeground1 = argb("242424"),          // colorNeutralForeground1
  neutralForeground2 = argb("424242"),          // colorNeutralForeground2
  neutralForeground3 = argb("616161"),          // colorNeutralForeground3
  neutralForeground4 = argb("707070"),          // colorNeutralForeground4
  neutralForegroundDisabled = argb("BDBDBD"),   // colorNeutralForegroundDisabled
  brandForeground1 = argb("0F6CBD"),            // colorBrandForeground1
  brandForeground2 = argb("115EA3"),            // colorBrandForeground2
  errorForeground = argb("B10E1C"),             // colorStatusDangerForeground1
  successForeground = argb("0E700E"),           // colorStatusSuccessForeground1
  warningForeground = argb("BC4B09"),           // colorStatusWarningForeground1
  errorForegroundOnSubtle = argb("B10E1C"),
  successForegroundOnSubtle = argb("0E700E"),
  warningForegroundOnSubtle = argb("BC4B09"),
  foregroundOnAccent = argb("FFFFFF"),          // colorNeutralForegroundOnBrand

  neutralBackground1 = argb("FFFFFF"),
  neutralBackground2 = argb("FAFAFA"),
  neutralBackground3 = argb("F5F5F5"),
  neutralBackground4 = argb("F0F0F0"),
  neutralBackground5 = argb("EBEBEB"),
  neutralBackgroundDisabled = argb("EBEBEB"),
  brandBackground = argb("0F6CBD"),             // colorBrandBackground
  brandBackgroundHover = argb("115EA3"),
  brandBackgroundPressed = argb("0C3B5E"),
  brandBackgroundDisabled = argb("EBF3FC"),     // colorBrandBackground2
  errorBackground = argb("FDF3F4"),             // colorStatusDangerBackground1
  successBackground = argb("F1FAF1"),
  warningBackground = argb("FFF9F5"),
  subtleBackground = Color.Transparent,
  subtleBackgroundHover = argb("F5F5F5"),
  subtleBackgroundPressed = argb("E0E0E0"),

  // colorBrandBackground2 + the brand shade stepped from it.  On the inverse
  // surface the accent has to come from the *dark* ramp to stay legible.
  brandContainer = argb("EBF3FC"),             // colorBrandBackground2
  brandContainerForeground = argb("0C3B5E"),
  brandOnInverse = argb("96C6FA"),

  neutralStroke1 = argb("616161"),              // colorNeutralStrokeAccessible
  neutralStroke2 = argb("D1D1D1"),              // colorNeutralStroke1
  neutralStroke3 = argb("E0E0E0"),              // colorNeutralStroke2
  neutralStrokeDisabled = argb("E0E0E0"),
  brandStroke = argb("0F6CBD"),                 // colorBrandStroke1
  errorStroke = argb("C50F1F"),                 // colorStatusDangerForeground3

  // Fluent separates a card from its page by elevation, not by tint: the card is
  // NeutralBackground1 plus shadow2/4 and a hairline.
  surfaceCard = argb("FFFFFF"),
  surfaceCardContainer = argb("FAFAFA"),
  surfaceFlyout = argb("FFFFFF"),
  neutralLayerInner = argb("F5F5F5"),        // colorNeutralBackground3 on a white card
  inverseBackground = argb("1B1B1B"),
  inverseForeground = argb("FFFFFF"),
  // Official colorBackgroundOverlay is rgba(0,0,0,.4); Compose applies the
  // alpha at the dialog/scrim site, so the alias holds the opaque base.
  scrim = argb("000000")
)

val FluentDarkColors = FluentColorTokens(
  neutralForeground1 = argb("FFFFFF"),
  neutralForeground2 = argb("D6D6D6"),
  neutralForeground3 = argb("ADADAD"),
  neutralForeground4 = argb("999999"),
  neutralForegroundDisabled = argb("5C5C5C"),
  brandForeground1 = argb("479EF5"),
  brandForeground2 = argb("62ABF5"),
  // DEVIATION: official colorStatusDangerForeground1 (#DC626D) measures 4.16:1
  // as small text on the dark page surface, under WCAG AA.  Lightened to
  // #E37680 (4.97:1 on the page, 5.63:1 on a card), keeping the same hue.
  errorForeground = argb("E37680"),
  successForeground = argb("54B054"),
  warningForeground = argb("FAA06B"),
  errorForegroundOnSubtle = argb("DC626D"),     // 4.96:1 on the deep danger tint
  successForegroundOnSubtle = argb("54B054"),
  warningForegroundOnSubtle = argb("FAA06B"),
  foregroundOnAccent = argb("FFFFFF"),

  neutralBackground1 = argb("292929"),
  neutralBackground2 = argb("1F1F1F"),
  neutralBackground3 = argb("141414"),
  neutralBackground4 = argb("0A0A0A"),
  neutralBackground5 = argb("000000"),
  neutralBackgroundDisabled = argb("1F1F1F"),
  brandBackground = argb("115EA3"),             // colorBrandBackground (dark)
  brandBackgroundHover = argb("0F6CBD"),
  brandBackgroundPressed = argb("0C3B5E"),
  brandBackgroundDisabled = argb("082338"),
  errorBackground = argb("3B0509"),
  successBackground = argb("052505"),
  warningBackground = argb("4A1E04"),
  subtleBackground = Color.Transparent,
  subtleBackgroundHover = argb("383838"),
  subtleBackgroundPressed = argb("2E2E2E"),

  brandContainer = argb("082338"),             // colorBrandBackground2 (dark)
  brandContainerForeground = argb("96C6FA"),
  brandOnInverse = argb("0F6CBD"),

  neutralStroke1 = argb("ADADAD"),              // colorNeutralStrokeAccessible
  neutralStroke2 = argb("666666"),              // colorNeutralStroke1
  neutralStroke3 = argb("525252"),              // colorNeutralStroke2
  neutralStrokeDisabled = argb("525252"),
  brandStroke = argb("479EF5"),
  errorStroke = argb("EEACB2"),                 // colorStatusDangerForeground3

  // In dark, Fluent layers *up* by lightening, so the card matches the page and
  // gains separation from its shadow only — the same rule as light, applied
  // consistently rather than inverting the ladder.
  surfaceCard = argb("292929"),
  surfaceCardContainer = argb("1F1F1F"),
  surfaceFlyout = argb("2E2E2E"),
  neutralLayerInner = argb("383838"),        // steps *up* from the card, as light does
  inverseBackground = argb("F5F5F5"),
  inverseForeground = argb("1B1B1B"),
  scrim = argb("000000")
)

// ─── Brand seeds for the theme picker ───────────────────────────────────────
//
// Only the accent ramp is retinted; the neutral ladder is theme-invariant, which
// is why a seed change never moves text contrast.

@Immutable
data class FluentBrandSeed(
  val id: String,
  val labelZh: String,
  val swatch: Color,
  val lightForeground: Color,
  val lightForegroundHover: Color,
  val lightBackground: Color,
  val lightBackgroundHover: Color,
  val lightBackgroundPressed: Color,
  val lightBackgroundDisabled: Color,
  val darkForeground: Color,
  val darkForegroundHover: Color,
  val darkBackground: Color,
  val darkBackgroundHover: Color,
  val darkBackgroundPressed: Color,
  val darkBackgroundDisabled: Color
)

val FluentBrandSeeds = listOf(
  FluentBrandSeed(
    id = "blue", labelZh = "蓝", swatch = argb("0F6CBD"),
    lightForeground = argb("0F6CBD"), lightForegroundHover = argb("115EA3"),
    lightBackground = argb("0F6CBD"), lightBackgroundHover = argb("115EA3"),
    lightBackgroundPressed = argb("0C3B5E"), lightBackgroundDisabled = argb("EBF3FC"),
    darkForeground = argb("479EF5"), darkForegroundHover = argb("62ABF5"),
    darkBackground = argb("115EA3"), darkBackgroundHover = argb("0F6CBD"),
    darkBackgroundPressed = argb("0C3B5E"), darkBackgroundDisabled = argb("082338")
  ),
  FluentBrandSeed(
    id = "green", labelZh = "绿", swatch = argb("107C10"),
    lightForeground = argb("0E700E"), lightForegroundHover = argb("0B5C0B"),
    lightBackground = argb("107C10"), lightBackgroundHover = argb("0E700E"),
    lightBackgroundPressed = argb("075407"), lightBackgroundDisabled = argb("F1FAF1"),
    darkForeground = argb("54B054"), darkForegroundHover = argb("7CC87C"),
    darkBackground = argb("0E700E"), darkBackgroundHover = argb("107C10"),
    darkBackgroundPressed = argb("052505"), darkBackgroundDisabled = argb("052505")
  ),
  FluentBrandSeed(
    id = "purple", labelZh = "紫", swatch = argb("5C2E91"),
    lightForeground = argb("5C2E91"), lightForegroundHover = argb("4C2678"),
    lightBackground = argb("5C2E91"), lightBackgroundHover = argb("4C2678"),
    lightBackgroundPressed = argb("3A1D5C"), lightBackgroundDisabled = argb("F2EBFA"),
    darkForeground = argb("B49BE0"), darkForegroundHover = argb("C9B8EA"),
    darkBackground = argb("4C2678"), darkBackgroundHover = argb("5C2E91"),
    darkBackgroundPressed = argb("2A1540"), darkBackgroundDisabled = argb("1E0F2E")
  ),
  FluentBrandSeed(
    id = "teal", labelZh = "青", swatch = argb("038387"),
    lightForeground = argb("038387"), lightForegroundHover = argb("026D71"),
    lightBackground = argb("038387"), lightBackgroundHover = argb("026D71"),
    lightBackgroundPressed = argb("015053"), lightBackgroundDisabled = argb("E6F6F6"),
    darkForeground = argb("4CC4C8"), darkForegroundHover = argb("78D4D7"),
    darkBackground = argb("026D71"), darkBackgroundHover = argb("038387"),
    darkBackgroundPressed = argb("013A3C"), darkBackgroundDisabled = argb("012627")
  ),
  FluentBrandSeed(
    id = "orange", labelZh = "橙", swatch = argb("C4420A"),
    lightForeground = argb("BC4B09"), lightForegroundHover = argb("9A3E07"),
    lightBackground = argb("C4420A"), lightBackgroundHover = argb("BC4B09"),
    lightBackgroundPressed = argb("8A3005"), lightBackgroundDisabled = argb("FFF9F5"),
    darkForeground = argb("FAA06B"), darkForegroundHover = argb("F7BB95"),
    darkBackground = argb("BC4B09"), darkBackgroundHover = argb("C4420A"),
    darkBackgroundPressed = argb("4A1E04"), darkBackgroundDisabled = argb("4A1E04")
  ),
  FluentBrandSeed(
    id = "rose", labelZh = "玫红", swatch = argb("C2185B"),
    lightForeground = argb("B01352"), lightForegroundHover = argb("8F0F43"),
    lightBackground = argb("C2185B"), lightBackgroundHover = argb("B01352"),
    lightBackgroundPressed = argb("840E3E"), lightBackgroundDisabled = argb("FDF0F5"),
    darkForeground = argb("F178A9"), darkForegroundHover = argb("F5A0C2"),
    darkBackground = argb("8F0F43"), darkBackgroundHover = argb("B01352"),
    darkBackgroundPressed = argb("40071E"), darkBackgroundDisabled = argb("40071E")
  )
)

/**
 * Retint the accent aliases for a theme seed — the accent and the accent-derived
 * containers only.  The neutral and status aliases come through untouched, which
 * is what keeps text contrast seed-independent.  The container pair is derived
 * from the seed's own ramp (tint ← its disabled fill, foreground ← its pressed
 * shade) rather than hand-picked, so picking green never leaves MS Blue behind.
 */
fun brandTokensForSeed(seed: FluentBrandSeed, isDark: Boolean): FluentColorTokens {
  val base = if (isDark) FluentDarkColors else FluentLightColors
  return if (isDark) base.copy(
    brandForeground1 = seed.darkForeground,
    brandForeground2 = seed.darkForegroundHover,
    brandBackground = seed.darkBackground,
    brandBackgroundHover = seed.darkBackgroundHover,
    brandBackgroundPressed = seed.darkBackgroundPressed,
    brandBackgroundDisabled = seed.darkBackgroundDisabled,
    brandStroke = seed.darkForeground,
    brandContainer = seed.darkBackgroundDisabled,
    brandContainerForeground = seed.darkForegroundHover,
    // An inverse surface in dark mode is a *light* field, so the accent has to
    // come from the light ramp to stay legible on it.
    brandOnInverse = seed.lightForeground
  ) else base.copy(
    brandForeground1 = seed.lightForeground,
    brandForeground2 = seed.lightForegroundHover,
    brandBackground = seed.lightBackground,
    brandBackgroundHover = seed.lightBackgroundHover,
    brandBackgroundPressed = seed.lightBackgroundPressed,
    brandBackgroundDisabled = seed.lightBackgroundDisabled,
    brandStroke = seed.lightForeground,
    brandContainer = seed.lightBackgroundDisabled,
    brandContainerForeground = seed.lightBackgroundPressed,
    brandOnInverse = seed.darkForeground
  )
}

// ─── Chart palette ──────────────────────────────────────────────────────────
//
// Ten hues chosen to stay distinguishable in both themes and to survive the
// common deuteranopia/confusion axes; Fluent's own categorical set is not
// published as web tokens, so this is the one ramp that is hand-picked.

val FluentChartPalette = listOf(
  argb("0F6CBD"),  // blue
  argb("107C10"),  // green
  argb("984F0B"),  // brown
  argb("5C2E91"),  // purple
  argb("038387"),  // teal
  argb("C2185B"),  // rose
  argb("4C4A48"),  // slate
  argb("005B70"),  // deep cyan
  argb("7A4E00"),  // ochre
  argb("B10E1C")   // red
)

// ─── Dynamic accent (Android 12+ wallpaper colours) ─────────────────────────
//
// Material You hands us an arbitrary hue.  Retinting the Fluent aliases with
// that hue's *raw* colour would put an unknown contrast pair in front of users,
// so we keep only its hue and saturation and rebuild the accent ladder to the
// same relative-luminance steps the default blue ramp uses.  The neutral and
// status aliases never move, which is what makes this safe: text contrast is
// fixed, and only the accent changes.

private fun srgbLuminance(c: Color): Double {
  fun lin(v: Float) =
    if (v <= 0.03928f) v / 12.92f else Math.pow(((v + 0.055) / 1.055).toDouble(), 2.4).toFloat()
  return 0.2126 * lin(c.red) + 0.7152 * lin(c.green) + 0.0722 * lin(c.blue)
}

private fun hslToColor(h: Double, s: Double, l: Double): Color {
  val sat = s.coerceIn(0.0, 1.0)
  val lum = l.coerceIn(0.0, 1.0)
  val c = (1 - Math.abs(2 * lum - 1)) * sat
  val x = c * (1 - Math.abs(((h / 60.0) % 2) - 1))
  val m = lum - c / 2
  val (r1, g1, b1) = when {
    h < 60 -> Triple(c, x, 0.0)
    h < 120 -> Triple(x, c, 0.0)
    h < 180 -> Triple(0.0, c, x)
    h < 240 -> Triple(0.0, x, c)
    h < 300 -> Triple(x, 0.0, c)
    else -> Triple(c, 0.0, x)
  }
  return Color(
    (r1 + m).toFloat().coerceIn(0f, 1f),
    (g1 + m).toFloat().coerceIn(0f, 1f),
    (b1 + m).toFloat().coerceIn(0f, 1f)
  )
}

private fun colorToHueSat(c: Color): Pair<Double, Double> {
  val r = c.red.toDouble()
  val g = c.green.toDouble()
  val b = c.blue.toDouble()
  val max = maxOf(r, g, b)
  val min = minOf(r, g, b)
  val delta = max - min
  if (delta < 1e-6) return 0.0 to 0.0
  val hue = when (max) {
    r -> 60.0 * (((g - b) / delta) % 6)
    g -> 60.0 * ((b - r) / delta + 2)
    else -> 60.0 * ((r - g) / delta + 4)
  }
  val sat = delta / (1 - Math.abs(max + min - 1))
  return ((hue + 360) % 360) to sat.coerceIn(0.0, 1.0)
}

/**
 * Return the colour of [target] luminance that shares [base]'s hue and
 * saturation.  A bisection on lightness is used rather than a fixed offset
 * because HSL lightness and perceived luminance diverge hardest at the yellows,
 * which is exactly where a naive ramp goes illegible.
 */
private fun recolorToLuminance(base: Color, target: Double): Color {
  val (hue, rawSat) = colorToHueSat(base)
  // Achromatic dynamic seeds (grey/black/white primary) carry no hue to rebuild
  // from; fall back to the default blue so the accent never disappears.
  val sat = if (rawSat < 0.08) 0.72 else rawSat
  val h = if (rawSat < 0.08) 206.0 else hue
  var lo = 0.0
  var hi = 1.0
  // Luminance rises monotonically with lightness at fixed hue/saturation, so the
  // bisection converges; 24 steps lands within 1e-7 of the target.
  repeat(24) {
    val mid = (lo + hi) / 2
    if (srgbLuminance(hslToColor(h, sat, mid)) < target) lo = mid else hi = mid
  }
  return hslToColor(h, sat, (lo + hi) / 2)
}

/** Luminance targets read off the default blue ramp, per accent role. */
private const val ACCENT_FOREGROUND_LIGHT = 0.128
private const val ACCENT_HOVER_LIGHT = 0.098
private const val ACCENT_PRESSED_LIGHT = 0.05
private const val ACCENT_CONTAINER_LIGHT = 0.905
private const val ACCENT_FOREGROUND_DARK = 0.37
private const val ACCENT_HOVER_DARK = 0.46
private const val ACCENT_CONTAINER_DARK = 0.028
private const val ACCENT_PRESSED_DARK = 0.05

/**
 * Retint every accent alias from an arbitrary [seedColor] (typically
 * `MaterialTheme.colorScheme.primary` under dynamic colour), preserving the
 * measured luminance of each role.
 */
fun dynamicAccentTokens(base: FluentColorTokens, seedColor: Color, isDark: Boolean): FluentColorTokens {
  return if (isDark) base.copy(
    brandForeground1 = recolorToLuminance(seedColor, ACCENT_FOREGROUND_DARK),
    brandForeground2 = recolorToLuminance(seedColor, ACCENT_HOVER_DARK),
    brandBackground = recolorToLuminance(seedColor, ACCENT_HOVER_LIGHT),
    brandBackgroundHover = recolorToLuminance(seedColor, ACCENT_FOREGROUND_LIGHT),
    brandBackgroundPressed = recolorToLuminance(seedColor, ACCENT_PRESSED_LIGHT),
    brandBackgroundDisabled = recolorToLuminance(seedColor, ACCENT_CONTAINER_DARK),
    brandStroke = recolorToLuminance(seedColor, ACCENT_FOREGROUND_DARK),
    brandContainer = recolorToLuminance(seedColor, ACCENT_CONTAINER_DARK),
    brandContainerForeground = recolorToLuminance(seedColor, ACCENT_HOVER_DARK),
    brandOnInverse = recolorToLuminance(seedColor, ACCENT_FOREGROUND_LIGHT)
  ) else base.copy(
    brandForeground1 = recolorToLuminance(seedColor, ACCENT_FOREGROUND_LIGHT),
    brandForeground2 = recolorToLuminance(seedColor, ACCENT_HOVER_LIGHT),
    brandBackground = recolorToLuminance(seedColor, ACCENT_FOREGROUND_LIGHT),
    brandBackgroundHover = recolorToLuminance(seedColor, ACCENT_HOVER_LIGHT),
    brandBackgroundPressed = recolorToLuminance(seedColor, ACCENT_PRESSED_LIGHT),
    brandBackgroundDisabled = recolorToLuminance(seedColor, ACCENT_CONTAINER_LIGHT),
    brandStroke = recolorToLuminance(seedColor, ACCENT_FOREGROUND_LIGHT),
    brandContainer = recolorToLuminance(seedColor, ACCENT_CONTAINER_LIGHT),
    brandContainerForeground = recolorToLuminance(seedColor, ACCENT_PRESSED_LIGHT),
    brandOnInverse = recolorToLuminance(seedColor, ACCENT_FOREGROUND_DARK)
  )
}

// ─── CompositionLocal ───────────────────────────────────────────────────────

val LocalFluentColors = staticCompositionLocalOf { FluentLightColors }
