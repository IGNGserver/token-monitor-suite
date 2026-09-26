package com.igng.tokenmonitor.android.ui.components

import androidx.annotation.DrawableRes
import com.igng.tokenmonitor.android.R

/**
 * Fluent System Icons, vendored by `npm run update:fluent-assets`.
 *
 * These replace `androidx.compose.material.icons.*` throughout the client.  The
 * reason is not brand loyalty: Material Symbols and Fluent System Icons are two
 * different drawing conventions (grid, stroke weight, corner treatment, terminal
 * shapes), so an app that is Fluent everywhere else but renders a Material glyph in
 * its navigation bar is showing two systems at once — and the navigation bar is the
 * most-repeated surface in the app.
 *
 * Weight is `regular` only, by design.  The client previously mixed `Filled` and
 * `Outlined` from Material in the *same row* (`Icons.Default.Add` beside
 * `Icons.Outlined.Settings`), which is not a hierarchy, just two accents.  Fluent
 * mobile uses regular for navigation and actions and reserves `filled` for a
 * selected state; where that matters it is expressed here by tint and the underline,
 * not by swapping the glyph (`FluentNavBar`).
 *
 * Names are the official Fluent asset names with `_24_regular` dropped, so a reader
 * can find the source file.
 */
internal object FluentIcons {
  // Chrome icons are referenced by name from `FluentIcons.home` etc.; the
  // generated drawable is `fluent_<file>`, so the two lists must stay in step.
  @DrawableRes val Home = R.drawable.fluent_home
  @DrawableRes val Poll = R.drawable.fluent_poll
  @DrawableRes val PhoneLaptop = R.drawable.fluent_phone_laptop
  @DrawableRes val Apps = R.drawable.fluent_apps
  @DrawableRes val Settings = R.drawable.fluent_settings
  @DrawableRes val Info = R.drawable.fluent_info
  @DrawableRes val ArrowSync = R.drawable.fluent_arrow_sync
  @DrawableRes val ArrowClockwise = R.drawable.fluent_arrow_clockwise
  @DrawableRes val Add = R.drawable.fluent_add
  @DrawableRes val Checkmark = R.drawable.fluent_checkmark
  @DrawableRes val ChevronLeft = R.drawable.fluent_chevron_left
  @DrawableRes val ChevronRight = R.drawable.fluent_chevron_right
  @DrawableRes val ChevronDown = R.drawable.fluent_chevron_down
  @DrawableRes val ChevronUp = R.drawable.fluent_chevron_up
  @DrawableRes val Box = R.drawable.fluent_box
  @DrawableRes val Folder = R.drawable.fluent_folder
  @DrawableRes val LinkDismiss = R.drawable.fluent_link_dismiss
  @DrawableRes val Heart = R.drawable.fluent_heart
  @DrawableRes val Chat = R.drawable.fluent_chat
  @DrawableRes val Wallet = R.drawable.fluent_wallet
  @DrawableRes val Timeline = R.drawable.fluent_timeline
  @DrawableRes val ChartMultiple = R.drawable.fluent_chart_multiple
  @DrawableRes val DataTrending = R.drawable.fluent_data_trending
  @DrawableRes val History = R.drawable.fluent_history
  @DrawableRes val BoardSplit = R.drawable.fluent_board_split
  @DrawableRes val Dismiss = R.drawable.fluent_dismiss
  @DrawableRes val AlertBadge = R.drawable.fluent_alert_badge
  @DrawableRes val ArrowExport = R.drawable.fluent_arrow_export
}
