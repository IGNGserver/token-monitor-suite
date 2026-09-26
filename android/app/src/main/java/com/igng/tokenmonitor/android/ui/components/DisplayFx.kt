package com.igng.tokenmonitor.android.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf

// ─── Display currency ───────────────────────────────────────────────────────
//
// Deliberately a separate file from `Formatters.kt`: that file is pure and is
// exercised by the JVM unit tests, and the Android test runner cannot load the
// Compose runtime at all (`CompositionLocalKt` → ClassNotFoundException, which
// takes the whole file's class initializer down with it).  A CompositionLocal in
// there would silently make every formatter untestable.

/**
 * A cost formatter bound to the user's display currency and the Hub's current rate.
 *
 * A function rather than a parameter because the cost appears in eleven components,
 * and a formatter that has to be threaded by hand is a formatter that gets skipped at
 * the eleventh call site and quietly prints `US$` again.
 *
 * Falls back to USD when no rate block has arrived: printing a converted figure at a
 * made-up rate is worse than printing the stored one with its real symbol.
 */
@Composable
fun rememberCostFormatter(): CostFormatter {
  val fx = LocalDisplayFx.current
  return remember(fx) { CostFormatter(fx.currency, fx.rateFor(fx.currency)) }
}

/** Pair of (currency code, USD→currency multiplier); [rate] null means "do not convert". */
data class DisplayFx(val currency: String = "USD", val rates: Map<String, Double> = emptyMap()) {
  fun rateFor(code: String): Double? = if (code == "USD") 1.0 else rates[code]
}

val LocalDisplayFx = staticCompositionLocalOf { DisplayFx() }

class CostFormatter(val currency: String, val rate: Double?) {
  fun format(value: Double, compact: Boolean = false): String =
    formatMoney(value, currency, rate, compact)
}

