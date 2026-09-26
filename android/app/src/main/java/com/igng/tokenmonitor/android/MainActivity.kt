package com.igng.tokenmonitor.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.igng.tokenmonitor.android.data.local.ThemeMode
import com.igng.tokenmonitor.android.data.local.UserPreferencesStore
import com.igng.tokenmonitor.android.ui.TokenMonitorApp
import com.igng.tokenmonitor.android.ui.haptics.LocalHapticsMode
import com.igng.tokenmonitor.android.ui.theme.TokenMonitorTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
  @Inject lateinit var preferencesStore: UserPreferencesStore

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent {
      val prefs by preferencesStore.preferences.collectAsStateWithLifecycle()
      // Edge-to-edge is re-asserted rather than set once in onCreate, because the
      // client can now pin dark-on-a-light-system (or the reverse) independently of
      // the platform.  `enableEdgeToEdge()` defaults to *auto*, which follows the
      // system, so a pinned mode would have left light status-bar glyphs on a dark
      // page.  The resolved value comes from the same rule `TokenMonitorTheme` uses.
      val dark = when (prefs.themeMode) {
        ThemeMode.Light -> false
        ThemeMode.Dark -> true
        // The same source of truth `TokenMonitorTheme` uses, so the glyphs can
        // never disagree with the surface they sit on.
        ThemeMode.System -> isSystemInDarkTheme()
      }
      LaunchedEffect(dark) {
        enableEdgeToEdge(
          statusBarStyle = if (dark) SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
          else SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
          navigationBarStyle = if (dark) SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
          else SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT)
        )
      }
      TokenMonitorTheme(themeSeed = prefs.themeSeed, themeMode = prefs.themeMode) {
        CompositionLocalProvider(LocalHapticsMode provides prefs.hapticsMode) {
          TokenMonitorApp()
        }
      }
    }
  }
}
