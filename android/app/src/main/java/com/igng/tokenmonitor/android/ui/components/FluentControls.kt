package com.igng.tokenmonitor.android.ui.components

import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.annotation.DrawableRes
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.igng.tokenmonitor.android.ui.theme.FluentElevationDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentMotion
import com.igng.tokenmonitor.android.ui.theme.FluentShapeDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentSpacingDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentTypeRamp
import com.igng.tokenmonitor.android.ui.theme.LocalFluentAdaptation
import com.igng.tokenmonitor.android.ui.theme.LocalFluentColors
import com.igng.tokenmonitor.android.ui.theme.fluentMotionEnabled

// ─── Fluent 2 interactive controls ─────────────────────────────────────────
//
// Everything here exists because Material's version of the same widget encodes
// Material's design language in ways the Fluent token bridge cannot undo:
//
//   • `Switch` is 52×32 with a ✓ baked into the thumb, so "off" is carried by
//     absence of tint.  Fluent's ToggleSwitch is 40×20 and marks off with a
//     *stroke* — which is also the accessible answer.
//   • `Button` resolves its corner through `FilledButtonTokens.ContainerShape`, a
//     shape-token path `MaterialTheme.shapes` cannot override, and tints a
//     circular ripple.  Fluent holds controls at 4 dp and changes the surface's
//     *value* on press instead.
//   • `OutlinedTextField` floats its label into the border and thickens that
//     border on focus; that affordance is its shape, not its colour.
//   • `AlertDialog` expresses height with Material's tonal containers — precisely
//     the mechanism Fluent rejects in favour of flat surface + elevation + stroke.
//
// Three rules every control below obeys:
//   1. rest / hover / pressed / disabled / selected / focus are all expressed, and
//      none of them by colour alone (WCAG 1.4.1).
//   2. Focus is visible.  `indication = null` removed Material's ripple, and a
//      ripple was never a focus indicator anyway; without [fluentFocusRing] there
//      would be no keyboard or d-pad focus anywhere in the app.
//   3. Touch targets are `FluentTouchMin` (48 dp), never Fluent web's 44 px — the
//      platform's accessibility floor outranks the design token, and the hit area
//      is the control, not the paint inside it.

// ─── Press / focus plumbing ─────────────────────────────────────────────────

/**
 * Fluent's focus indicator: a 2 dp inset outline in the accessible stroke colour,
 * which `LocalFluentColors.neutralStroke1` holds at ≥3:1 on both the page and a
 * card (asserted by `npm run verify:android-fluent-contrast`).
 *
 * Inset rather than outset on purpose: an outset ring needs its parent to reserve
 * the space, and a ring that silently clips to zero inside a dense row is worse
 * than no ring, because it looks implemented.
 */
@Composable
fun Modifier.fluentFocusRing(
  interaction: MutableInteractionSource,
  shape: Shape = FluentShapeDefaults.controlCorner,
  color: Color = LocalFluentColors.current.neutralStroke1
): Modifier {
  if (!interaction.collectIsFocusedAsState().value) return this
  return border(2.dp, color, shape)
}

/**
 * The single place a Fluent control wires up click, hover, press, focus and role,
 * so no screen has to remember that removing Material's ripple also means
 * supplying a focus ring.
 */
@Composable
fun Modifier.fluentClickable(
  interaction: MutableInteractionSource,
  onClick: (() -> Unit)?,
  role: Role = Role.Button,
  enabled: Boolean = true,
  focusRingColor: Color = LocalFluentColors.current.neutralStroke1,
  focusShape: Shape = FluentShapeDefaults.controlCorner
): Modifier {
  val ring = fluentFocusRing(interaction, focusShape, focusRingColor)
  if (onClick == null || !enabled) return this.then(ring)
  return this
    .hoverable(interaction)
    .clickable(
      interactionSource = interaction,
      indication = null,
      role = role,
      onClick = onClick
    )
    .then(ring)
}

// ─── Buttons ────────────────────────────────────────────────────────────────

/** Fill style.  All four variants share corner, height, motion and focus. */
@Immutable
enum class FluentButtonVariant {
  /** Brand fill — the page's primary action. */
  Filled,

  /** Neutral fill — secondary action sitting beside a [Filled]. */
  Subtle,

  /** 1 dp outline — tertiary; the only outline Fluent allows on a button. */
  Outline,

  /** No container — inline and toolbar actions. */
  Quiet
}

@Composable
private fun fluentButtonPalette(
  variant: FluentButtonVariant,
  enabled: Boolean
) = when (variant) {
  FluentButtonVariant.Filled -> FluentButtonPalette(
    rest = LocalFluentColors.current.brandBackground,
    hover = LocalFluentColors.current.brandBackgroundHover,
    press = LocalFluentColors.current.brandBackgroundPressed,
    disabled = LocalFluentColors.current.brandBackgroundDisabled,
    foreground = if (enabled) {
      LocalFluentColors.current.foregroundOnAccent
    } else {
      LocalFluentColors.current.neutralForegroundDisabled
    },
    ring = LocalFluentColors.current.foregroundOnAccent,
    stroked = false
  )
  FluentButtonVariant.Subtle -> FluentButtonPalette(
    rest = LocalFluentColors.current.neutralLayerInner,
    hover = LocalFluentColors.current.subtleBackgroundHover,
    press = LocalFluentColors.current.subtleBackgroundPressed,
    disabled = LocalFluentColors.current.neutralBackgroundDisabled,
    foreground = if (enabled) {
      LocalFluentColors.current.neutralForeground1
    } else {
      LocalFluentColors.current.neutralForegroundDisabled
    },
    ring = LocalFluentColors.current.neutralStroke1,
    stroked = false
  )
  FluentButtonVariant.Outline -> FluentButtonPalette(
    rest = Color.Transparent,
    hover = LocalFluentColors.current.subtleBackgroundHover,
    press = LocalFluentColors.current.subtleBackgroundPressed,
    disabled = Color.Transparent,
    foreground = if (enabled) {
      LocalFluentColors.current.brandForeground1
    } else {
      LocalFluentColors.current.neutralForegroundDisabled
    },
    ring = LocalFluentColors.current.neutralStroke1,
    stroked = true
  )
  FluentButtonVariant.Quiet -> FluentButtonPalette(
    rest = Color.Transparent,
    hover = LocalFluentColors.current.subtleBackgroundHover,
    press = LocalFluentColors.current.subtleBackgroundPressed,
    disabled = Color.Transparent,
    foreground = if (enabled) {
      LocalFluentColors.current.brandForeground1
    } else {
      LocalFluentColors.current.neutralForegroundDisabled
    },
    ring = LocalFluentColors.current.neutralStroke1,
    stroked = false
  )
}

private class FluentButtonPalette(
  val rest: Color,
  val hover: Color,
  val press: Color,
  val disabled: Color,
  val foreground: Color,
  val ring: Color,
  val stroked: Boolean
)

/**
 * Fluent button. [filledWidth] is what the settings and dialog call sites used to
 * get from a Material `Button` that quietly filled its row.
 */
@Composable
fun FluentButton(
  label: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  variant: FluentButtonVariant = FluentButtonVariant.Filled,
  enabled: Boolean = true,
  filledWidth: Boolean = false,
  leadingIcon: Int? = null,
  contentDescription: String? = null
) {
  val colors = LocalFluentColors.current
  val palette = fluentButtonPalette(variant, enabled)
  val interaction = remember { MutableInteractionSource() }
  val pressed by interaction.collectIsPressedAsState()
  val hovered = enabled && rememberFluentHover(interaction)
  val shape = FluentShapeDefaults.controlCorner
  val background by animateColorAsState(
    targetValue = when {
      !enabled -> palette.disabled
      pressed -> palette.press
      hovered -> palette.hover
      else -> palette.rest
    },
    animationSpec = tween(FluentMotion.ultraFast),
    label = "buttonBg"
  )
  val widthMod = if (filledWidth) Modifier.fillMaxWidth() else Modifier
  Box(
    widthMod
      .then(modifier)
      // Fluent *web* holds a button at 32 dp; Android's accessibility floor is 48 dp,
      // and the platform floor wins — that is rule 3 at the top of this file.
      .defaultMinSize(minHeight = FluentTouchMin)
      .clip(shape)
      .background(background)
      .then(
        if (palette.stroked && enabled) Modifier.border(1.dp, colors.neutralStroke1, shape)
        else Modifier
      )
      .then(
        Modifier.fluentClickable(
          interaction = interaction,
          onClick = onClick,
          enabled = enabled,
          focusRingColor = palette.ring,
          focusShape = shape
        )
      )
      .padding(horizontal = FluentSpacingDefaults.l, vertical = FluentSpacingDefaults.s),
    contentAlignment = Alignment.Center
  ) {
    Row(verticalAlignment = Alignment.CenterVertically) {
      if (leadingIcon != null) {
        Icon(
          painter = painterResource(leadingIcon),
          contentDescription = null,
          tint = palette.foreground,
          modifier = Modifier.size(16.dp)
        )
        Spacer(Modifier.width(FluentSpacingDefaults.xs))
      }
      Text(
        label,
        style = FluentTypeRamp.body1,
        fontWeight = FontWeight.SemiBold,
        color = palette.foreground,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = if (contentDescription == null) Modifier
        else Modifier.semantics { this.contentDescription = contentDescription }
      )
    }
  }
}

/**
 * Icon-only button: a 4 dp square hover/press tint on a [FluentTouchMin] target.
 * Material's `IconButton` is the same box but paints a *circular* ripple and no
 * hover, which is what made it read as a different family from its own row.
 */
@Composable
fun FluentIconButton(
  @DrawableRes icon: Int,
  contentDescription: String,
  onClick: (() -> Unit)?,
  modifier: Modifier = Modifier,
  enabled: Boolean = true,
  tint: Color = LocalFluentColors.current.neutralForeground1,
  targetSize: Dp = FluentTouchMin,
  iconSize: Dp = 20.dp
) {
  val colors = LocalFluentColors.current
  val interaction = remember { MutableInteractionSource() }
  val pressed by interaction.collectIsPressedAsState()
  val hovered = enabled && onClick != null && rememberFluentHover(interaction)
  val shape = FluentShapeDefaults.controlCorner
  val background by animateColorAsState(
    targetValue = when {
      pressed -> colors.subtleBackgroundPressed
      hovered -> colors.subtleBackgroundHover
      else -> Color.Transparent
    },
    animationSpec = tween(FluentMotion.ultraFast),
    label = "iconButtonBg"
  )
  Box(
    modifier
      .size(targetSize)
      .clip(shape)
      .background(background)
      .then(
        Modifier.fluentClickable(
          interaction = interaction,
          onClick = onClick,
          enabled = enabled,
          focusShape = shape
        )
      ),
    contentAlignment = Alignment.Center
  ) {
    Icon(
      painter = painterResource(icon),
      contentDescription = contentDescription,
      tint = if (enabled) tint else colors.neutralForegroundDisabled,
      modifier = Modifier.size(iconSize)
    )
  }
}

// ─── Toggle ─────────────────────────────────────────────────────────────────

/**
 * Fluent's ToggleSwitch: a 40×20 track with a 16 dp thumb.
 *
 * "Off" carries a 1 dp stroke in the accessible colour and the state is also
 * announced (`Role.Switch` + `toggleable` ⇒ `State.Checkable`), because tint alone
 * fails WCAG 1.4.1 — Material's version marks "on" with a glyph and "off" with
 * nothing at all.
 *
 * The 48 dp hit area is the *outer* box, not the track: a 20 dp tall target is not
 * reachable with a thumb, and that is the one thing the platform floor is for.
 */
@Composable
fun FluentToggle(
  checked: Boolean,
  onCheckedChange: (Boolean) -> Unit,
  modifier: Modifier = Modifier,
  enabled: Boolean = true,
  label: String? = null
) {
  val colors = LocalFluentColors.current
  val interaction = remember { MutableInteractionSource() }
  val trackShape = RoundedCornerShape(10.dp)
  val track by animateColorAsState(
    targetValue = when {
      !enabled -> colors.neutralBackgroundDisabled
      checked -> colors.brandBackground
      else -> Color.Transparent
    },
    animationSpec = tween(FluentMotion.fast),
    label = "toggleTrack"
  )
  val thumb by animateColorAsState(
    targetValue = when {
      !enabled -> colors.neutralForegroundDisabled
      checked -> colors.foregroundOnAccent
      else -> colors.neutralForeground1
    },
    animationSpec = tween(FluentMotion.fast),
    label = "toggleThumb"
  )
  val thumbOffset by animateDpAsState(
    targetValue = if (checked) 20.dp else 0.dp,
    animationSpec = tween(FluentMotion.fast, easing = FluentMotion.standard),
    label = "toggleThumbX"
  )
  Box(
    modifier
      .defaultMinSize(minWidth = FluentTouchMin, minHeight = FluentTouchMin)
      .semantics { label?.let { contentDescription = it } },
    contentAlignment = Alignment.Center
  ) {
    Box(
      Modifier
        .width(40.dp)
        .height(20.dp)
        .clip(trackShape)
        .then(
          if (checked || !enabled) Modifier
          else Modifier.border(1.dp, colors.neutralStroke1, trackShape)
        )
        .background(track)
        // Applied to the track, but the parent Box is the min-size target, so the
        // whole 48 dp square is live.
        .toggleable(
          value = checked,
          enabled = enabled,
          role = Role.Switch,
          interactionSource = interaction,
          indication = null,
          onValueChange = onCheckedChange
        )
        .then(Modifier.fluentFocusRing(interaction, trackShape))
    ) {
      Box(
        Modifier
          .padding(start = 2.dp + thumbOffset)
          .align(Alignment.CenterStart)
          .size(16.dp)
          .clip(CircleShape)
          .background(thumb)
      )
    }
  }
}

// ─── Text field ─────────────────────────────────────────────────────────────

/**
 * Fluent's Field: label permanently above, border pinned at 1 dp, and focus drawn
 * as a ring *outside* the border rather than a thicker border.
 */
@Composable
fun FluentTextField(
  value: String,
  onValueChange: (String) -> Unit,
  label: String,
  modifier: Modifier = Modifier,
  enabled: Boolean = true,
  readOnly: Boolean = false,
  singleLine: Boolean = true,
  isPassword: Boolean = false,
  supportingText: String? = null,
  errorText: String? = null,
  placeholder: String? = null,
  keyboardType: KeyboardType = KeyboardType.Text
) {
  val colors = LocalFluentColors.current
  val interaction = remember { MutableInteractionSource() }
  val focused = interaction.collectIsFocusedAsState().value
  val shape = FluentShapeDefaults.controlCorner
  val borderColor = when {
    errorText != null -> colors.errorStroke
    focused -> colors.brandStroke
    !enabled -> colors.neutralStrokeDisabled
    else -> colors.neutralStroke1
  }
  Column(modifier.fillMaxWidth()) {
    Text(
      label,
      style = FluentTypeRamp.caption1,
      fontWeight = FontWeight.SemiBold,
      color = if (enabled) colors.neutralForeground2 else colors.neutralForegroundDisabled
    )
    Spacer(Modifier.height(FluentSpacingDefaults.xs))
    Box(
      Modifier
        .fillMaxWidth()
        .defaultMinSize(minHeight = 40.dp)
        .clip(shape)
        .background(if (enabled) colors.surfaceCard else colors.neutralBackgroundDisabled)
        .border(if (focused) 2.dp else 1.dp, borderColor, shape)
        .then(Modifier.fluentFocusRing(interaction, shape))
        .padding(horizontal = FluentSpacingDefaults.m, vertical = FluentSpacingDefaults.s)
    ) {
      BasicTextField(
        value = value,
        onValueChange = onValueChange,
        enabled = enabled && !readOnly,
        singleLine = singleLine,
        visualTransformation =
          if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        textStyle = TextStyle(color = colors.neutralForeground1),
        cursorBrush = SolidColor(colors.brandForeground1),
        decorationBox = { inner ->
          Row(verticalAlignment = Alignment.CenterVertically) {
            if (placeholder != null && value.isEmpty()) {
              Text(placeholder, style = FluentTypeRamp.body1, color = colors.neutralForeground4)
            }
            Box(Modifier.weight(1f)) { inner() }
          }
        }
      )
    }
    val message = errorText ?: supportingText
    if (message != null) {
      Spacer(Modifier.height(FluentSpacingDefaults.xxs))
      Text(
        message,
        style = FluentTypeRamp.caption2,
        color = if (errorText != null) colors.errorForeground else colors.neutralForeground3
      )
    }
  }
}

// ─── Dialog ─────────────────────────────────────────────────────────────────

/**
 * Fluent's modal surface, factored out of the flyout `DateTimeRangePicker` used to
 * hand-build: flat `surfaceFlyout`, `largeCorner`, `level16` elevation and a
 * hairline.  The stroke is not decoration — a shadow alone vanishes on a dark
 * surface, which is the same reason the web dialog carries one.
 */
@Composable
fun FluentDialog(
  onDismissRequest: () -> Unit,
  modifier: Modifier = Modifier,
  title: String? = null,
  subtitle: String? = null,
  confirmText: String? = null,
  onConfirm: (() -> Unit)? = null,
  dismissText: String? = null,
  body: @Composable ColumnScope.() -> Unit
) {
  val colors = LocalFluentColors.current
  val adaptation = LocalFluentAdaptation.current
  Dialog(
    onDismissRequest = onDismissRequest,
    properties = DialogProperties(usePlatformDefaultWidth = false)
  ) {
    Box(
      Modifier
        .fillMaxSize()
        .background(colors.scrim.copy(alpha = 0.6f))
        .clickable(
          interactionSource = remember { MutableInteractionSource() },
          indication = null,
          onClick = onDismissRequest
        ),
      contentAlignment = Alignment.Center
    ) {
      val panelShape = FluentShapeDefaults.largeCorner
      Column(
        modifier
          .widthIn(max = if (adaptation.isLarge) 520.dp else 440.dp)
          .padding(FluentSpacingDefaults.l)
          // Shadow first, so it sits behind the surface rather than clipping it.
          .shadow(FluentElevationDefaults.level16, panelShape, clip = false)
          .clip(panelShape)
          .background(colors.surfaceFlyout)
          .border(0.5.dp, colors.neutralStroke3, panelShape)
          // Consume the tap that lands on the panel itself.
          .clickable(
            interactionSource = remember { MutableInteractionSource() },
            indication = null,
            onClick = {}
          )
          .padding(FluentSpacingDefaults.xl)
      ) {
        if (title != null) {
          Text(
            title,
            style = FluentTypeRamp.title2,
            color = colors.neutralForeground1,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
          )
        }
        if (subtitle != null) {
          Spacer(Modifier.height(FluentSpacingDefaults.xs))
          Text(subtitle, style = FluentTypeRamp.caption1, color = colors.neutralForeground2)
        }
        Spacer(Modifier.height(FluentSpacingDefaults.l))
        Column(Modifier.fillMaxWidth()) { body() }
        if (confirmText != null || dismissText != null) {
          Spacer(Modifier.height(FluentSpacingDefaults.xl))
          Row(
            Modifier
              .fillMaxWidth()
              .imePadding(),
            horizontalArrangement = Arrangement.spacedBy(FluentSpacingDefaults.s, Alignment.End)
          ) {
            if (dismissText != null) {
              FluentButton(
                label = dismissText,
                onClick = onDismissRequest,
                variant = FluentButtonVariant.Subtle
              )
            }
            if (confirmText != null && onConfirm != null) {
              FluentButton(label = confirmText, onClick = onConfirm)
            }
          }
        }
      }
    }
  }
}

// ─── Busy indicators ────────────────────────────────────────────────────────

/**
 * Fluent's ProgressRing.  Material's gap-ring is 4 dp of stroke with a notched
 * end; this is a 2 dp sweep with rounded caps, and it holds a static arc when the
 * user has suppressed motion rather than carrying on regardless.
 */
@Composable
fun FluentProgressRing(
  modifier: Modifier = Modifier,
  size: Dp = 28.dp,
  strokeWidth: Dp = 2.dp,
  color: Color = LocalFluentColors.current.brandForeground1,
  trackColor: Color = LocalFluentColors.current.neutralStroke3
) {
  val motion = fluentMotionEnabled()
  val transition = rememberInfiniteTransition(label = "progressRing")
  val sweep by transition.animateFloat(
    initialValue = 0f,
    targetValue = 360f,
    animationSpec = infiniteRepeatable(
      animation = tween(FluentMotion.slower, easing = LinearEasing),
      repeatMode = RepeatMode.Restart
    ),
    label = "progressSweep"
  )
  Canvas(modifier = modifier.size(size)) {
    val style = Stroke(width = strokeWidth.toPx(), cap = StrokeCap.Round)
    drawArc(color = trackColor, startAngle = 0f, sweepAngle = 360f, useCenter = false, style = style)
    drawArc(
      color = color,
      startAngle = if (motion) sweep else 270f,
      sweepAngle = if (motion) 110f else 270f,
      useCenter = false,
      style = style
    )
  }
}

/** The linear counterpart, for determinate values (upload, cache fill). */
@Composable
fun FluentProgressBar(
  fraction: Float,
  modifier: Modifier = Modifier,
  color: Color = LocalFluentColors.current.brandBackground,
  trackColor: Color = LocalFluentColors.current.neutralLayerInner
) {
  val clamped = fraction.coerceIn(0f, 1f)
  Box(
    modifier
      .fillMaxWidth()
      .height(4.dp)
      .clip(RoundedCornerShape(2.dp))
      .background(trackColor)
  ) {
    Box(
      Modifier
        .fillMaxWidth(clamped)
        .height(4.dp)
        .clip(RoundedCornerShape(2.dp))
        .background(color)
    )
  }
}

// ─── Choice ─────────────────────────────────────────────────────────────────

/**
 * One-of-many choice with a radio affordance.  The theme picker was a hand-rolled
 * `Row + clickable + tint`, which announced nothing at all: selection existed only
 * as a colour.  `selectable(role = RadioButton)` puts the state in the tree.
 */
@Composable
fun FluentRadioOption(
  selected: Boolean,
  onSelect: () -> Unit,
  label: String,
  modifier: Modifier = Modifier,
  description: String? = null,
  leading: @Composable (() -> Unit)? = null
) {
  val colors = LocalFluentColors.current
  val interaction = remember { MutableInteractionSource() }
  val pressed by interaction.collectIsPressedAsState()
  val hovered = rememberFluentHover(interaction)
  val shape = FluentShapeDefaults.controlCorner
  Row(
    modifier
      .fillMaxWidth()
      .defaultMinSize(minHeight = FluentTouchMin)
      .clip(shape)
      .background(
        when {
          pressed -> colors.subtleBackgroundPressed
          hovered -> colors.subtleBackgroundHover
          else -> Color.Transparent
        }
      )
      .selectable(
        selected = selected,
        role = Role.RadioButton,
        interactionSource = interaction,
        indication = null,
        onClick = onSelect
      )
      .then(Modifier.fluentFocusRing(interaction, shape))
      .padding(horizontal = FluentSpacingDefaults.m, vertical = FluentSpacingDefaults.s),
    verticalAlignment = Alignment.CenterVertically
  ) {
    if (leading != null) {
      leading()
      Spacer(Modifier.width(FluentSpacingDefaults.m))
    }
    Column(Modifier.weight(1f)) {
      Text(
        label,
        style = FluentTypeRamp.body1,
        color = colors.neutralForeground1,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
      if (description != null) {
        Text(
          description,
          style = FluentTypeRamp.caption1,
          color = colors.neutralForeground2
        )
      }
    }
    Spacer(Modifier.width(FluentSpacingDefaults.s))
    Box(
      Modifier
        .size(20.dp)
        .clip(CircleShape)
        .border(
          1.dp,
          if (selected) colors.brandStroke else colors.neutralStroke1,
          CircleShape
        ),
      contentAlignment = Alignment.Center
    ) {
      // Alpha rather than AnimatedVisibility: the dot must keep the circle's
      // geometry whether or not it is on, and a visibility toggle inside a Box
      // scope is a receiver error waiting to happen.
      Box(
        Modifier
          .size(10.dp)
          .alpha(if (selected) 1f else 0f)
          .clip(CircleShape)
          .background(colors.brandForeground1)
      )
    }
  }
}

/**
 * A selectable row that changes *what the screen shows* rather than navigating.
 * `FluentListRow(onClick = …)` is drill-in (`Role.Button`); this is scope and
 * filter picking, and announcing the difference is the entire point of `Role.Tab`.
 */
@Composable
fun FluentChoiceRow(
  selected: Boolean,
  onSelect: () -> Unit,
  label: String,
  modifier: Modifier = Modifier,
  role: Role = Role.Tab,
  description: String? = null
) {
  val colors = LocalFluentColors.current
  val interaction = remember { MutableInteractionSource() }
  val pressed by interaction.collectIsPressedAsState()
  val hovered = rememberFluentHover(interaction)
  val shape = FluentShapeDefaults.controlCorner
  Row(
    modifier
      .fillMaxWidth()
      .defaultMinSize(minHeight = FluentTouchMin)
      .clip(shape)
      .background(
        when {
          selected -> colors.brandContainer
          pressed -> colors.subtleBackgroundPressed
          hovered -> colors.subtleBackgroundHover
          else -> Color.Transparent
        }
      )
      .selectable(
        selected = selected,
        role = role,
        interactionSource = interaction,
        indication = null,
        onClick = onSelect
      )
      .then(Modifier.fluentFocusRing(interaction, shape))
      .padding(horizontal = FluentSpacingDefaults.m, vertical = FluentSpacingDefaults.s),
    verticalAlignment = Alignment.CenterVertically
  ) {
    Column(Modifier.weight(1f)) {
      Text(
        label,
        style = FluentTypeRamp.body1,
        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
        color = if (selected) colors.brandContainerForeground else colors.neutralForeground1
      )
      if (description != null) {
        Text(description, style = FluentTypeRamp.caption2, color = colors.neutralForeground3)
      }
    }
    if (selected) {
      Spacer(Modifier.width(FluentSpacingDefaults.s))
      Box(
        Modifier
          .width(2.dp)
          .height(20.dp)
          .background(colors.brandStroke)
      )
    }
  }
}
