package com.igng.tokenmonitor.android.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// ─── Fluent 2 type ramp ────────────────────────────────────────────────────
//
// Sizes and line-heights are the official `fontSizeBase*` / `lineHeightBase*` /
// `fontSizeHero*` / `lineHeightHero*` web tokens, mapped 1:1 to sp so the
// Android system font scale still applies on top.
//
// Note the base size is 14, not Material's 16 — the whole ramp sits a step
// smaller, which is what buys a phone dashboard its density.  Fluent's ramp is
// 400 (regular) / 500 (medium) / 600 (semibold) / 700 (bold); headings from
// `title3` up are semibold, and emphasis below that comes from colour tier
// rather than weight.
//
// Level        px/line   Weight    Token
// ─────────────────────────────────────────────────────────────────────
// caption2     10 / 14   regular   fontSizeBase100
// caption1     12 / 16   regular   fontSizeBase200
// body2        14 / 20   regular   fontSizeBase300
// body1        14 / 20   regular   fontSizeBase300
// subtitle     16 / 22   regular   fontSizeBase400
// title3       16 / 22   semibold  fontSizeBase400
// title2       20 / 28   semibold  fontSizeBase500
// title1       24 / 32   semibold  fontSizeBase600
// largeTitle   28 / 36   semibold  fontSizeHero700
// display      40 / 52   semibold  fontSizeHero900
// ─────────────────────────────────────────────────────────────────────

@Immutable
data class FluentTypography(
  val caption2: TextStyle,
  val caption1: TextStyle,
  val body2: TextStyle,
  val body1: TextStyle,
  val subtitle: TextStyle,
  val title3: TextStyle,
  val title2: TextStyle,
  val title1: TextStyle,
  val largeTitle: TextStyle,
  val display: TextStyle
)

private val ff = FontFamily.SansSerif

val FluentTypeRamp = FluentTypography(
  caption2 = TextStyle(
    fontFamily = ff, fontWeight = FontWeight.Normal,
    fontSize = 10.sp, lineHeight = 14.sp
  ),
  caption1 = TextStyle(
    fontFamily = ff, fontWeight = FontWeight.Normal,
    fontSize = 12.sp, lineHeight = 16.sp
  ),
  body2 = TextStyle(
    fontFamily = ff, fontWeight = FontWeight.Normal,
    fontSize = 14.sp, lineHeight = 20.sp
  ),
  body1 = TextStyle(
    fontFamily = ff, fontWeight = FontWeight.Normal,
    fontSize = 14.sp, lineHeight = 20.sp
  ),
  subtitle = TextStyle(
    fontFamily = ff, fontWeight = FontWeight.Normal,
    fontSize = 16.sp, lineHeight = 22.sp
  ),
  title3 = TextStyle(
    fontFamily = ff, fontWeight = FontWeight.SemiBold,
    fontSize = 16.sp, lineHeight = 22.sp
  ),
  title2 = TextStyle(
    fontFamily = ff, fontWeight = FontWeight.SemiBold,
    fontSize = 20.sp, lineHeight = 28.sp
  ),
  title1 = TextStyle(
    fontFamily = ff, fontWeight = FontWeight.SemiBold,
    fontSize = 24.sp, lineHeight = 32.sp
  ),
  largeTitle = TextStyle(
    fontFamily = ff, fontWeight = FontWeight.SemiBold,
    fontSize = 28.sp, lineHeight = 36.sp
  ),
  display = TextStyle(
    fontFamily = ff, fontWeight = FontWeight.SemiBold,
    fontSize = 40.sp, lineHeight = 52.sp
  )
)
