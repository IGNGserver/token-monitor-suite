package com.igng.tokenmonitor.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.abs

/**
 * Desktop-aligned client labels & brand colors (from electron usageCharts / app.js).
 * Unknown ids fall back to a stable hashed chart color.
 */
object ClientBranding {
  val labels: Map<String, String> = mapOf(
    "claude" to "Claude Code",
    "claude-desktop" to "Claude Desktop",
    "codex" to "Codex",
    "hermes" to "Hermes",
    "gemini" to "Gemini",
    "cursor" to "Cursor",
    "opencode" to "OpenCode",
    "openclaw" to "OpenClaw",
    "antigravity" to "Antigravity",
    "cline" to "Cline",
    "kimi" to "Kimi",
    "qwen" to "Qwen",
    "grok" to "Grok Build",
    "copilot" to "GitHub Copilot",
    "pi" to "Pi",
    "zed" to "Zed",
    "kilocode" to "Kilo Code",
    "micode" to "MiMo Code",
    "zcode" to "ZCode",
    "kiro" to "Kiro",
    "codebuddy" to "CodeBuddy",
    "workbuddy" to "WorkBuddy",
    "proma" to "Proma",
    "deepseek-harness" to "DeepSeek Harness",
    "deepseek" to "DeepSeek",
    "xiaomi" to "Xiaomi",
    "mimo" to "MiMo",
    "minimax" to "MiniMax",
    "doubao" to "Doubao",
    "ollama" to "Ollama",
    "moonshot" to "Moonshot",
    "xai" to "xAI",
    "meta" to "Meta",
    "mistral" to "Mistral",
    "zai" to "Z.ai",
    "zaiteam" to "Z.ai Team",
    "cohere" to "Cohere",
    "volcengine" to "Volcengine",
    "qoder" to "Qoder",
    "openrouter" to "OpenRouter"
  )

  private val colors: Map<String, Color> = mapOf(
    "claude" to Color(0xFFCC7C5E),
    "claude-desktop" to Color(0xFFD4927A),
    "codex" to Color(0xFF49A3B0),
    "hermes" to Color(0xFFD4AF37),
    "gemini" to Color(0xFF4285F4),
    "antigravity" to Color(0xFF4285F4),
    "cline" to Color(0xFF323B43),
    "kimi" to Color(0xFF16191E),
    "grok" to Color(0xFF222222),
    "copilot" to Color(0xFF24292F),
    "deepseek" to Color(0xFF4D6BFE),
    "deepseek-harness" to Color(0xFF4D6BFE),
    "cursor" to Color(0xFF2D2D2D),
    "opencode" to Color(0xFF1A1A1A),
    "openclaw" to Color(0xFFFF4D4D),
    "xai" to Color(0xFF222222),
    "meta" to Color(0xFF1D65C1),
    "mistral" to Color(0xFFFA520F),
    "qwen" to Color(0xFF615CED),
    "pi" to Color(0xFF333333),
    "zed" to Color(0xFF4173E7),
    "kilocode" to Color(0xFFF8F676),
    "micode" to Color(0xFF333333),
    "mimo" to Color(0xFFFF6700),
    "xiaomi" to Color(0xFFFF6700),
    "zcode" to Color(0xFF333333),
    "kiro" to Color(0xFF9046FF),
    "codebuddy" to Color(0xFF6C4DFF),
    "workbuddy" to Color(0xFF0DC8A5),
    "proma" to Color(0xFF333333),
    "moonshot" to Color(0xFF16191E),
    "minimax" to Color(0xFFF23F5D),
    "doubao" to Color(0xFF1E37FC),
    "ollama" to Color(0xFF888888),
    "zai" to Color(0xFF333333),
    "zaiteam" to Color(0xFF333333),
    "cohere" to Color(0xFF39594D),
    "volcengine" to Color(0xFF006EFF),
    "qoder" to Color(0xFF2ADB5C),
    "openrouter" to Color(0xFF6B57FF),
    "default" to Color(0xFF6AB4F0)
  )

  private val fallbacks = listOf(
    Color(0xFF6AB4F0),
    Color(0xFFCC7C5E),
    Color(0xFFA57DF0),
    Color(0xFF49A3B0),
    Color(0xFFF0D66A),
    Color(0xFFF06A7B)
  )

  fun label(id: String): String {
    val key = id.trim().lowercase()
    if (key == "其他" || key.equals("other", true)) return "其他"
    return labels[key] ?: id
  }

  fun color(id: String): Color {
    val key = id.trim().lowercase()
    if (key == "其他" || key.equals("other", true)) return colors.getValue("default")
    colors[key]?.let { return liftDark(it) }
    // stable hash
    var hash = 0
    for (ch in key) hash = (hash * 31 + ch.code)
    return fallbacks[abs(hash) % fallbacks.size]
  }

  /** Slightly lighten near-black brand colors so they stay visible on dark surfaces. */
  private fun liftDark(c: Color): Color {
    val lum = 0.2126f * c.red + 0.7152f * c.green + 0.0722f * c.blue
    return if (lum < 0.12f) c.copy(red = 0.45f, green = 0.45f, blue = 0.48f) else c
  }

  fun monogram(id: String): String {
    val label = label(id)
    val parts = label.split(' ', '-', '_').filter { it.isNotBlank() }
    return when {
      parts.size >= 2 -> "${parts[0].first().uppercaseChar()}${parts[1].first().uppercaseChar()}"
      label.length >= 2 -> label.take(2).replaceFirstChar { it.uppercaseChar() }
      label.isNotEmpty() -> label.take(1).uppercase()
      else -> "?"
    }
  }
}

@Composable
fun ClientMonogram(
  clientId: String,
  modifier: Modifier = Modifier,
  size: Dp = 28.dp
) {
  val bg = ClientBranding.color(clientId)
  val fg = if (0.2126f * bg.red + 0.7152f * bg.green + 0.0722f * bg.blue > 0.55f) {
    Color(0xFF1A1A1A)
  } else {
    Color.White
  }
  Box(
    modifier = modifier
      .size(size)
      .background(bg, CircleShape),
    contentAlignment = Alignment.Center
  ) {
    Text(
      ClientBranding.monogram(clientId),
      color = fg,
      fontSize = (size.value * 0.36f).sp,
      fontWeight = FontWeight.Bold,
      style = MaterialTheme.typography.labelSmall
    )
  }
}
