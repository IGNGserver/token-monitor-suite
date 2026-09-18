package com.igng.tokenmonitor.android.ui

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.ContextWrapper
import android.os.Bundle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalContext

/**
 * Report this Activity's foreground state to [onChange].
 *
 * The live SSE stream must not keep an authenticated connection open, answer
 * keepalive pings, and re-dial on a 1-30s backoff while the app is backgrounded:
 * `viewModelScope` outlives `onStop`, so the loop used to keep running (battery,
 * radio, and Hub-side connection churn for a client the user believes is idle).
 *
 * Deliberately avoids resolving a ViewModel here — a second `hiltViewModel()` call
 * could create a second HubViewModel and therefore a second stream. The effect
 * attaches to the Activity the composition already lives in and reports only
 * transitions, so the initial state is an explicit [onChange] call rather than a
 * lifecycle read (androidx.lifecycle is not a declared dependency of this module).
 */
@Composable
fun ActivityForegroundEffect(onChange: (Boolean) -> Unit) {
  val context = LocalContext.current
  DisposableEffect(context) {
    val activity = context.findActivity()
    val application = activity?.application
    if (activity == null || application == null) {
      // No Activity (e.g. a preview): assume foreground so the stream still runs.
      onChange(true)
      return@DisposableEffect onDispose { }
    }

    var foreground = false
    val callback = object : Application.ActivityLifecycleCallbacks {
      override fun onActivityStarted(started: Activity) {
        if (started === activity && !foreground) {
          foreground = true
          onChange(true)
        }
      }

      override fun onActivityStopped(stopped: Activity) {
        if (stopped === activity && foreground) {
          foreground = false
          onChange(false)
        }
      }

      override fun onActivityCreated(created: Activity, savedInstanceState: Bundle?) = Unit
      override fun onActivityResumed(resumed: Activity) = Unit
      override fun onActivityPaused(paused: Activity) = Unit
      override fun onActivitySaveInstanceState(saved: Activity, outState: Bundle) = Unit
      override fun onActivityDestroyed(destroyed: Activity) = Unit
    }

    application.registerActivityLifecycleCallbacks(callback)
    // The Activity is normally already started when the composition is created;
    // if it starts later onActivityStarted reports it.
    foreground = true
    onChange(true)

    onDispose {
      application.unregisterActivityLifecycleCallbacks(callback)
      if (foreground) {
        foreground = false
        onChange(false)
      }
    }
  }
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
  is Activity -> this
  is ContextWrapper -> baseContext.findActivity()
  else -> null
}
