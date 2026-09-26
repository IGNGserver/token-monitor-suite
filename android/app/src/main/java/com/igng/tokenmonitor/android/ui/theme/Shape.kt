package com.igng.tokenmonitor.android.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.dp

// ─── Fluent 2 shape tokens ──────────────────────────────────────────────────
//
// These are the official `borderRadius*` web steps, unchanged:
//
//   Token                 Value   Fluent source        Usage
//   ──────────────────────────────────────────────────────────────────
//   smallCorner            2 dp   borderRadiusSmall   badges, chart marks
//   controlCorner          4 dp   borderRadiusMedium  buttons, inputs, chips
//   cardCorner             8 dp   borderRadiusXLarge  cards, grouped containers
//   largeCorner           12 dp   borderRadius2XLarge dialogs, flyouts, sheets
//
// The load-bearing difference from Material 3 is `controlCorner`: Fluent puts
// interactive controls at 4 dp, where M3 defaults to 8–12.  Corner radius is
// Fluent's primary signal of "this is a control", so it has to stay tight or
// every button in the app starts reading as a container.

@Immutable
data class FluentShapes(
  val controlCorner: RoundedCornerShape = RoundedCornerShape(4.dp),
  val smallCorner: RoundedCornerShape = RoundedCornerShape(2.dp),
  val cardCorner: RoundedCornerShape = RoundedCornerShape(8.dp),
  val largeCorner: RoundedCornerShape = RoundedCornerShape(12.dp)
)

val FluentShapeDefaults = FluentShapes()
