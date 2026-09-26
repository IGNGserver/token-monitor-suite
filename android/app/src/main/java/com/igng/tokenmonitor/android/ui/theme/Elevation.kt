package com.igng.tokenmonitor.android.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// ─── Fluent 2 elevation ─────────────────────────────────────────────────────
//
// Fluent's shadow recipe is a key light plus an ambient light, published as the
// `shadow*` web tokens:
//
//   shadow2    0 0 2px rgba(0,0,0,.12), 0 1px  2px  rgba(0,0,0,.14)
//   shadow4    0 0 2px rgba(0,0,0,.12), 0 2px  4px  rgba(0,0,0,.14)
//   shadow8    0 0 2px rgba(0,0,0,.12), 0 4px  8px  rgba(0,0,0,.14)
//   shadow16   0 0 2px rgba(0,0,0,.12), 0 8px  16px rgba(0,0,0,.14)
//   shadow28   0 0 8px rgba(0,0,0,.12), 0 14px 28px rgba(0,0,0,.14)
//   shadow64   0 0 16px rgba(0,0,0,.12), 0 29px 64px rgba(0,0,0,.28)
//
// Compose's shadow renderer takes a single elevation and derives blur/spread
// itself, so the table below is the honest approximation: the Dp value is the
// key-light offset, which is what the ambient layer is scaled against.  Where
// the exact two-layer recipe matters (flyouts), the component also draws a
// hairline stroke, because a Compose shadow alone disappears on a dark surface
// the same way Fluent's does.
//
// Level   Component
// ──────────────────────────────────────────────────────────────────
// 0       page background, flat sections
// 2       card at rest
// 4       interactive card / button at rest
// 8       dropdown, tooltip
// 16      dialog, flyout
// 28      the largest transient surface
// 64      reserved; nothing in this app earns it

@Immutable
data class FluentElevation(
  val level0: Dp = 0.dp,
  val level2: Dp = 1.dp,
  val level4: Dp = 2.dp,
  val level8: Dp = 4.dp,
  val level16: Dp = 8.dp,
  val level28: Dp = 14.dp,
  val level64: Dp = 29.dp
)

val FluentElevationDefaults = FluentElevation()
