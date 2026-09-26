package com.igng.tokenmonitor.android.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// ─── Fluent 2 Spacing Tokens ────────────────────────────────────────────────
//
// Strict 4 dp grid (designUnit = 4 dp).  Every spacing / padding value in the
// app should reference one of these tokens so the visual rhythm is consistent.
//
// Token       Value   Typical usage
// ─────────────────────────────────────────────────────────────
// xxs         2 dp    Tight inner padding (icon to label)
// xs          4 dp    Minimal gap (chip inner, badge pad)
// s           8 dp    Compact gap (between related items)
// m          12 dp    Default inner card padding (horizontal)
// l          16 dp    Standard gap (between cards, list rows)
// xl         20 dp    Section spacing
// xxl        24 dp    Group spacing
// xxxl       32 dp    Large section gaps
// ─────────────────────────────────────────────────────────────

@Immutable
data class FluentSpacing(
  val xxs: Dp = 2.dp,
  val xs: Dp = 4.dp,
  val s: Dp = 8.dp,
  val m: Dp = 12.dp,
  val l: Dp = 16.dp,
  val xl: Dp = 20.dp,
  val xxl: Dp = 24.dp,
  val xxxl: Dp = 32.dp
)

val FluentSpacingDefaults = FluentSpacing()
