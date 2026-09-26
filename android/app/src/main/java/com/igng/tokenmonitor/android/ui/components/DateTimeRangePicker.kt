package com.igng.tokenmonitor.android.ui.components

import com.igng.tokenmonitor.android.ui.components.FluentIcons
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.igng.tokenmonitor.android.ui.haptics.HapticEvent
import com.igng.tokenmonitor.android.ui.haptics.rememberAppHaptics
import com.igng.tokenmonitor.android.ui.theme.FluentElevationDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentMotion
import com.igng.tokenmonitor.android.ui.theme.FluentShapeDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentSpacingDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentTypeRamp
import com.igng.tokenmonitor.android.ui.theme.LocalFluentColors
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle as DateTextStyle
import java.util.Locale
import kotlin.math.abs
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

// ─── Fluent 2 date & time range dialog ──────────────────────────────────────
//
// Fluent's picker is a *flyout*, not a Material tonal surface: `surfaceFlyout`
// at `largeCorner` (12dp) under `level16` elevation, with the commit commands in
// a bar pinned to the bottom edge and separated from the content by a hairline.
// Selection grammar matches the tab strip — squared (`controlCorner`) cells,
// brand fill for the endpoint, a light brand tint for the span, and a neutral
// stroke ring for "today" so today never competes with the selection.

/** Fluent day cells are 40dp minimum; the row keeps a hair of breathing room. */
private val FluentDayCellSize = 40.dp
private val FluentDayRowHeight = 44.dp
private val FluentCellFontSize = 14.sp

/** Fluent command-bar text buttons: quiet padding, `controlCorner` hit shape. */
private val FluentCommandPadding = PaddingValues(
  start = FluentSpacingDefaults.m,
  end = FluentSpacingDefaults.m,
  top = FluentSpacingDefaults.xs,
  bottom = FluentSpacingDefaults.xs
)

@Composable
fun DateTimeRangePickerDialog(
  onDismiss: () -> Unit,
  onConfirm: (startDate: LocalDate, endDate: LocalDate, startHour: Int, endHour: Int) -> Unit,
  initialStartDate: LocalDate? = null,
  initialEndDate: LocalDate? = null,
  initialStartHour: Int? = null,
  initialEndHour: Int? = null
) {
  val now = LocalDateTime.now()
  val startSeed = initialStartDate ?: now.toLocalDate()
  val endSeed = initialEndDate ?: now.toLocalDate()
  val haptics = rememberAppHaptics()
  val colors = LocalFluentColors.current

  var startDate by remember { mutableStateOf(startSeed) }
  var endDate by remember { mutableStateOf(endSeed) }
  // false = next click sets start; true = next click completes range
  var pickingEnd by remember { mutableStateOf(true) }
  var visibleMonth by remember { mutableStateOf(YearMonth.from(endDate)) }
  var startHour by remember { mutableIntStateOf((initialStartHour ?: 0).coerceIn(0, 23)) }
  var endHour by remember { mutableIntStateOf((initialEndHour ?: now.hour).coerceIn(0, 23)) }
  var errorText by remember { mutableStateOf("") }

  val rangeLabel = remember(startDate, endDate, startHour, endHour) {
    val fmt = DateTimeFormatter.ofPattern("MM-dd")
    "${fmt.format(startDate)} ${"%02d".format(startHour)}:00 → ${fmt.format(endDate)} ${"%02d".format(endHour)}:00"
  }

  // A modal enters with scale + fade on the deceleration curve (Fluent's rule:
  // arriving content settles, leaving content is simply gone).  The transform is
  // on a graphics layer rather than an `AnimatedVisibility`, so the dialog window
  // is measured at its final size on the very first frame.
  var revealed by remember { mutableStateOf(false) }
  LaunchedEffect(Unit) { revealed = true }
  // No manual `fluentMotionEnabled()` gate here: `animate*AsState` already honours the
  // platform animator-duration scale, which is exactly why the helpers that *do* need
  // a manual gate are the ones that bypass it — an `infiniteRepeatable` shimmer and an
  // `Animatable.animateTo` inside `LaunchedEffect`.
  val appearance by animateFloatAsState(
    targetValue = if (revealed) 1f else 0f,
    animationSpec = tween(FluentMotion.gentle, easing = FluentMotion.decelerate),
    label = "pickerAppearance"
  )

  Dialog(onDismissRequest = onDismiss) {
    Column(
      Modifier
        .graphicsLayer {
          alpha = appearance
          scaleX = 0.94f + 0.06f * appearance
          scaleY = 0.94f + 0.06f * appearance
        }
        .fillMaxWidth()
        .shadow(
          elevation = FluentElevationDefaults.level16,
          shape = FluentShapeDefaults.largeCorner,
          clip = false
        )
        .clip(FluentShapeDefaults.largeCorner)
        .background(colors.surfaceFlyout)
        .border(0.5.dp, colors.neutralStroke3, FluentShapeDefaults.largeCorner)
    ) {
      Column(
        Modifier
          .fillMaxWidth()
          .verticalScroll(rememberScrollState())
          .padding(
            start = FluentSpacingDefaults.l,
            end = FluentSpacingDefaults.l,
            top = FluentSpacingDefaults.l,
            bottom = FluentSpacingDefaults.m
          )
      ) {
        Text(
          "自定义时间范围",
          style = FluentTypeRamp.title2,
          color = colors.neutralForeground1
        )
        Spacer(Modifier.height(FluentSpacingDefaults.s))
        Text(
          "点选起止日期（可同一天），滚轮设置小时；结束小时含在内。",
          style = FluentTypeRamp.caption1,
          color = colors.neutralForeground2
        )
        Spacer(Modifier.height(FluentSpacingDefaults.xs))
        Text(
          rangeLabel,
          style = FluentTypeRamp.title3,
          color = colors.brandForeground1
        )
        Spacer(Modifier.height(FluentSpacingDefaults.l))
        RangeCalendar(
          month = visibleMonth,
          startDate = startDate,
          endDate = endDate,
          onMonthChange = { visibleMonth = it },
          onDayClick = { day ->
            haptics.perform(HapticEvent.Selection)
            errorText = ""
            if (!pickingEnd) {
              startDate = day
              endDate = day
              pickingEnd = true
            } else {
              if (day.isBefore(startDate)) {
                endDate = startDate
                startDate = day
              } else {
                endDate = day
              }
              pickingEnd = false
            }
          }
        )
        Spacer(Modifier.height(FluentSpacingDefaults.l))
        Text(
          "小时",
          style = FluentTypeRamp.caption1,
          fontWeight = FontWeight.SemiBold,
          letterSpacing = 0.5.sp,
          color = colors.neutralForeground3
        )
        Spacer(Modifier.height(FluentSpacingDefaults.s))
        // The hour rail sits in a nested container: Fluent steps a level down in
        // the background ladder (bg3) instead of tinting with brand colour.
        Box(
          Modifier
            .fillMaxWidth()
            .clip(FluentShapeDefaults.cardCorner)
            .background(colors.neutralLayerInner)
            .border(0.5.dp, colors.neutralStroke3, FluentShapeDefaults.cardCorner)
            .padding(vertical = FluentSpacingDefaults.s)
        ) {
          Row(
            Modifier
              .fillMaxWidth()
              .padding(horizontal = FluentSpacingDefaults.s),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
          ) {
            HourRail(
              label = "开始",
              value = startHour,
              onValueChange = {
                startHour = it
                haptics.perform(HapticEvent.Selection)
              }
            )
            Box(
              Modifier
                .width(0.5.dp)
                .height(72.dp)
                .background(colors.neutralStroke3)
            )
            HourRail(
              label = "结束",
              value = endHour,
              onValueChange = {
                endHour = it
                haptics.perform(HapticEvent.Selection)
              }
            )
          }
        }
        if (errorText.isNotBlank()) {
          Spacer(Modifier.height(FluentSpacingDefaults.s))
          Text(
            errorText,
            style = FluentTypeRamp.caption1,
            color = colors.errorForeground
          )
        }
      }

      // Hairline + command bar: Fluent docks the commands on the surface edge,
      // right-aligned, primary ahead of secondary.
      Box(
        Modifier
          .fillMaxWidth()
          .height(0.5.dp)
          .background(colors.neutralStroke3)
      )
      Row(
        Modifier
          .fillMaxWidth()
          .padding(
            start = FluentSpacingDefaults.s,
            end = FluentSpacingDefaults.s,
            top = FluentSpacingDefaults.xxs,
            bottom = FluentSpacingDefaults.xs
          ),
        horizontalArrangement = Arrangement.End,
        verticalAlignment = Alignment.CenterVertically
      ) {
        FluentButton(
          label = "确定",
          onClick = {
            val startOk = startDate.atTime(startHour, 0)
            val endOk = endDate.atTime(endHour, 0)
            if (endOk.isBefore(startOk)) {
              errorText = "结束时间必须晚于开始时间"
              haptics.perform(HapticEvent.Error)
              return@FluentButton
            }
            haptics.perform(HapticEvent.Confirm)
            onConfirm(startDate, endDate, startHour, endHour)
          }
        )
        Spacer(Modifier.width(FluentSpacingDefaults.xxs))
        FluentButton(
          label = "取消",
          onClick = {
            haptics.perform(HapticEvent.Tap)
            onDismiss()
          },
          variant = FluentButtonVariant.Subtle
        )
      }
    }
  }
}

@Composable
private fun RangeCalendar(
  month: YearMonth,
  startDate: LocalDate,
  endDate: LocalDate,
  onMonthChange: (YearMonth) -> Unit,
  onDayClick: (LocalDate) -> Unit
) {
  val colors = LocalFluentColors.current
  // Two different locales, on purpose.
  //
  // The *letters* stay Chinese because the interface is Chinese: an English device
  // showing "S M T W T F S" above an otherwise-Chinese calendar would be a worse
  // result than the current one.  The *week start* is the opposite case — it is a
  // CLDR fact about the user's calendar, and the previous code hardcoded Monday,
  // which put Sunday-start users a day off on every row.
  //
  // The grid follows `DateRanges.firstDayOfWeek` (CLDR), which is the display rule.  The
  // 本周 *scope window* is a separate, pinned ISO-Monday measurement — a picked range
  // here is answered by explicit days the user chose, so the two cannot disagree about a
  // reported total.
  val labelLocale = Locale.CHINA
  val weekFirstDay = com.igng.tokenmonitor.android.ui.core.DateRanges.firstDayOfWeek()
  val weekdayOrder = remember(weekFirstDay) {
    (0..6).map { offset ->
      DayOfWeek.of(((weekFirstDay.value - 1 + offset) % 7) + 1)
    }
  }
  val weekdays = weekdayOrder.map { it.getDisplayName(DateTextStyle.NARROW, labelLocale) }
  val firstOfMonth = month.atDay(1)
  val lead = (firstOfMonth.dayOfWeek.value - weekFirstDay.value + 7) % 7
  val daysInMonth = month.lengthOfMonth()
  val cells = remember(month) {
    buildList {
      repeat(lead) { add(null) }
      for (day in 1..daysInMonth) add(month.atDay(day))
      while (size % 7 != 0) add(null)
    }
  }
  val monthTitle = remember(month) {
    DateTimeFormatter.ofPattern("yyyy年M月", labelLocale).format(month.atDay(1))
  }
  val rangeStart = if (startDate.isAfter(endDate)) endDate else startDate
  val rangeEnd = if (startDate.isAfter(endDate)) startDate else endDate
  val dayTextStyle = remember {
    TextStyle(
      fontSize = FluentCellFontSize,
      fontWeight = FontWeight.Normal,
      textAlign = TextAlign.Center,
      platformStyle = PlatformTextStyle(includeFontPadding = false),
      lineHeightStyle = LineHeightStyle(
        alignment = LineHeightStyle.Alignment.Center,
        trim = LineHeightStyle.Trim.Both
      )
    )
  }

  Column(Modifier.fillMaxWidth()) {
    Row(
      Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      FluentIconButton(
        icon = FluentIcons.ChevronLeft,
        contentDescription = "上一月",
        onClick = { onMonthChange(month.minusMonths(1)) },
        tint = colors.neutralForeground2
      )
      Text(
        monthTitle,
        style = FluentTypeRamp.title3,
        color = colors.neutralForeground1
      )
      FluentIconButton(
        icon = FluentIcons.ChevronRight,
        contentDescription = "下一月",
        onClick = { onMonthChange(month.plusMonths(1)) },
        tint = colors.neutralForeground2
      )
    }
    Spacer(Modifier.height(FluentSpacingDefaults.xs))
    Row(Modifier.fillMaxWidth()) {
      weekdays.forEach { label ->
        Text(
          label,
          modifier = Modifier.weight(1f),
          textAlign = TextAlign.Center,
          style = FluentTypeRamp.caption2,
          color = colors.neutralForeground3
        )
      }
    }
    Spacer(Modifier.height(FluentSpacingDefaults.xxs))
    cells.chunked(7).forEach { week ->
      Row(
        Modifier
          .fillMaxWidth()
          .height(FluentDayRowHeight),
        verticalAlignment = Alignment.CenterVertically
      ) {
        week.forEach { date ->
          // Two fixes at once.  The cell used a bare `clickable`, i.e. Material's
          // default ripple, which stacked a *second* state layer on top of the
          // Fluent press/selected fills below; and it announced nothing, so a
          // screen reader heard an unnamed box for every day of the month.
          val cellInteraction = remember(date) { MutableInteractionSource() }
          Box(
            modifier = Modifier
              .weight(1f)
              .fillMaxHeight()
              .then(
                if (date != null) {
                  Modifier
                    .fluentClickable(
                      interaction = cellInteraction,
                      onClick = { onDayClick(date) }
                    )
                    .semantics {
                      contentDescription = cellDescription(date)
                    }
                } else {
                  Modifier
                }
              ),
            contentAlignment = Alignment.Center
          ) {
            if (date != null) {
              val inRange = !date.isBefore(rangeStart) && !date.isAfter(rangeEnd)
              val isStart = date == rangeStart
              val isEnd = date == rangeEnd
              val isEndpoint = isStart || isEnd
              val today = date == LocalDate.now()
              val multiDay = rangeStart != rangeEnd
              val stripColor = colors.brandBackground.copy(alpha = 0.12f)

              // Range band through the geometric centre, kept square so it reads
              // as a span of days rather than as one rounded pill.
              if (inRange && multiDay) {
                Row(
                  Modifier
                    .fillMaxWidth()
                    .height(FluentDayCellSize)
                    .align(Alignment.Center)
                ) {
                  Box(
                    Modifier
                      .weight(1f)
                      .fillMaxHeight()
                      .background(if (!isStart) stripColor else Color.Transparent)
                  )
                  Box(
                    Modifier
                      .weight(1f)
                      .fillMaxHeight()
                      .background(if (!isEnd) stripColor else Color.Transparent)
                  )
                }
              }

              val cellBackground by animateColorAsState(
                targetValue = if (isEndpoint) colors.brandBackground else Color.Transparent,
                animationSpec = tween(FluentMotion.normal, easing = FluentMotion.standard),
                label = "dayCellBackground"
              )
              val cellForeground by animateColorAsState(
                targetValue = when {
                  isEndpoint -> colors.foregroundOnAccent
                  today -> colors.brandForeground1
                  else -> colors.neutralForeground1
                },
                animationSpec = tween(FluentMotion.normal, easing = FluentMotion.standard),
                label = "dayCellForeground"
              )

              Box(
                modifier = Modifier
                  .align(Alignment.Center)
                  .size(FluentDayCellSize)
                  .clip(FluentShapeDefaults.controlCorner)
                  .background(cellBackground)
                  .then(
                    // "Today" is a ring, never a fill: it must not out-shout the
                    // selected endpoint it may coincide with.
                    if (today && !isEndpoint) {
                      Modifier.border(1.5.dp, colors.neutralStroke1, FluentShapeDefaults.controlCorner)
                    } else {
                      Modifier
                    }
                  ),
                contentAlignment = Alignment.Center
              ) {
                Text(
                  text = date.dayOfMonth.toString(),
                  style = dayTextStyle.copy(
                    fontWeight = if (isEndpoint || today) FontWeight.SemiBold else FontWeight.Normal,
                    color = cellForeground
                  )
                )
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Scrollable hour rail on the tab selection grammar: the centred hour takes
 * `brandForeground1` + semibold weight on a light brand band, the rest stay
 * tertiary.  The snap/scroll plumbing is unchanged from the Material version.
 */
@Composable
private fun HourRail(
  label: String,
  value: Int,
  onValueChange: (Int) -> Unit
) {
  val colors = LocalFluentColors.current
  val itemHeight = 40.dp
  val visibleCount = 3
  // Index layout: [top spacer][h0..h23][bottom spacer]
  // firstVisibleItemIndex == hour keeps that hour centered in the 3-row viewport.
  val listState = rememberLazyListState(
    initialFirstVisibleItemIndex = value.coerceIn(0, 23)
  )
  val fling = rememberSnapFlingBehavior(lazyListState = listState)
  val scope = rememberCoroutineScope()
  var suppress by remember { mutableStateOf(false) }

  fun listIndexForHour(hour: Int): Int = hour.coerceIn(0, 23)

  LaunchedEffect(value) {
    val target = listIndexForHour(value)
    if (listState.firstVisibleItemIndex != target || listState.firstVisibleItemScrollOffset != 0) {
      suppress = true
      listState.scrollToItem(target)
      suppress = false
    }
  }

  LaunchedEffect(listState) {
    snapshotFlow {
      val info = listState.layoutInfo
      if (info.visibleItemsInfo.isEmpty()) return@snapshotFlow null
      val viewportCenter = (info.viewportStartOffset + info.viewportEndOffset) / 2
      info.visibleItemsInfo
        .minByOrNull { item ->
          val itemCenter = item.offset + item.size / 2
          abs(itemCenter - viewportCenter)
        }
        ?.index
    }
      .filter { it != null }
      .map { index ->
        // index 0 = top spacer, 1..24 = hours 0..23, 25 = bottom spacer
        (index!! - 1).coerceIn(0, 23)
      }
      .distinctUntilChanged()
      .collect { hour ->
        if (suppress) return@collect
        if (hour != value) onValueChange(hour)
      }
  }

  Column(horizontalAlignment = Alignment.CenterHorizontally) {
    Text(
      label,
      style = FluentTypeRamp.caption1,
      color = colors.neutralForeground3
    )
    Spacer(Modifier.height(FluentSpacingDefaults.xs))
    Box(
      modifier = Modifier
        .height(itemHeight * visibleCount)
        .width(104.dp),
      contentAlignment = Alignment.Center
    ) {
      Box(
        Modifier
          .fillMaxWidth()
          .height(itemHeight)
          .clip(FluentShapeDefaults.controlCorner)
          .background(colors.brandBackground.copy(alpha = 0.12f))
          .align(Alignment.Center)
      )
      LazyColumn(
        state = listState,
        flingBehavior = fling,
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxSize()
      ) {
        item(key = "top-spacer") {
          Spacer(Modifier.height(itemHeight))
        }
        for (hour in 0..23) {
          item(key = "hour-$hour") {
            val selected = hour == value
            Box(
              modifier = Modifier
                .fillMaxWidth()
                .height(itemHeight)
                .clickable {
                  onValueChange(hour)
                  scope.launch {
                    listState.animateScrollToItem(listIndexForHour(hour))
                  }
                },
              contentAlignment = Alignment.Center
            ) {
              Text(
                text = "%02d:00".format(hour),
                textAlign = TextAlign.Center,
                fontSize = FluentCellFontSize,
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                color = if (selected) {
                  colors.brandForeground1
                } else {
                  colors.neutralForeground3
                },
                style = TextStyle(
                  platformStyle = PlatformTextStyle(includeFontPadding = false)
                )
              )
            }
          }
        }
        item(key = "bottom-spacer") {
          Spacer(Modifier.height(itemHeight))
        }
      }
    }
  }
}

/**
 * A date cell's accessible name.  Weekday and day-of-month are what a sighted user
 * reads off a grid, and they are exactly what a bare number does not convey — the
 * same cell also carries "start"/"end" as a fill colour, which is colour-only.
 */
internal fun cellDescription(date: LocalDate): String =
  date.format(DateTimeFormatter.ofPattern("yyyy 年 M 月 d 日 EEEE", Locale.CHINA)) +
    when (date.dayOfWeek) {
      DayOfWeek.SATURDAY, DayOfWeek.SUNDAY -> "，周末"
      else -> ""
    }
