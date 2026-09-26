@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.igng.tokenmonitor.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.ui.draw.shadow
import com.igng.tokenmonitor.android.ui.theme.FluentElevationDefaults
import com.igng.tokenmonitor.android.ui.theme.FluentShapeDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import com.igng.tokenmonitor.android.ui.theme.LocalFluentAdaptation
import com.igng.tokenmonitor.android.ui.theme.FluentSpacingDefaults
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import android.net.Uri
import com.igng.tokenmonitor.android.ui.analytics.AnalyticsScreen
import com.igng.tokenmonitor.android.ui.analytics.ClientDetailScreen
import com.igng.tokenmonitor.android.ui.analytics.ModelDetailScreen
import com.igng.tokenmonitor.android.ui.components.LocalDisplayFx
import com.igng.tokenmonitor.android.ui.components.DisplayFx
import com.igng.tokenmonitor.android.ui.components.FluentDestination
import com.igng.tokenmonitor.android.ui.components.FluentDestinations
import com.igng.tokenmonitor.android.ui.components.FluentNavBar
import com.igng.tokenmonitor.android.ui.components.FluentNavRail
import com.igng.tokenmonitor.android.ui.devices.DeviceDetailScreen
import com.igng.tokenmonitor.android.ui.devices.DevicesScreen
import com.igng.tokenmonitor.android.ui.haptics.HapticEvent
import com.igng.tokenmonitor.android.ui.haptics.rememberAppHaptics
import com.igng.tokenmonitor.android.ui.more.AccountsScreen
import com.igng.tokenmonitor.android.ui.more.SubscriptionsScreen
import com.igng.tokenmonitor.android.ui.more.MoreHubScreen
import com.igng.tokenmonitor.android.ui.more.PricingScreen
import com.igng.tokenmonitor.android.ui.more.ProjectsScreen
import com.igng.tokenmonitor.android.ui.more.SessionDetailScreen
import com.igng.tokenmonitor.android.ui.more.SessionsScreen
import com.igng.tokenmonitor.android.ui.more.SettingsScreen
import com.igng.tokenmonitor.android.ui.more.StatusScreen
import com.igng.tokenmonitor.android.ui.overview.OverviewScreen
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import com.igng.tokenmonitor.android.ui.theme.FluentMotion
import com.igng.tokenmonitor.android.ui.theme.fluentMotionEnabled
import com.igng.tokenmonitor.android.ui.theme.FluentTypeRamp
import com.igng.tokenmonitor.android.ui.theme.LocalFluentColors
import com.igng.tokenmonitor.android.ui.theme.fluentContentPopEnter
import com.igng.tokenmonitor.android.ui.theme.fluentContentPopExit
import com.igng.tokenmonitor.android.ui.theme.fluentContentPushEnter
import com.igng.tokenmonitor.android.ui.theme.fluentContentPushExit
import com.igng.tokenmonitor.android.ui.theme.fluentTabEnter
import com.igng.tokenmonitor.android.ui.theme.fluentTabExit

// ─── Adaptive layout policy ─────────────────────────────────────────────────
//
// Fluent 2 drives layout from window width, not device kind: a phone gets the
// bottom global-navigation bar, a 2-column width (>= 600dp, i.e. foldables,
// tablets and landscape phones) gets the leading rail so the content column can
// use the full height.  We also cap the content measure width on very large
// windows — a dashboard stretched to 1400dp reads as broken columns.

private val RailThresholdDp = 600.dp
private val ContentMaxWidthDp = 720.dp
private val RailWidthDp = 84.dp

/**
 * Compact = bottom bar, Medium+ = leading rail — the same rule the shared web UI
 * applies with its persistent-desktop / modal-mobile navigation, expressed in the
 * platform's own size classes.  Reads `FluentAdaptation` rather than
 * `LocalConfiguration` so this and every other adaptation decision see one window
 * measurement; `Configuration.screenWidthDp` is the display, which is wrong in
 * split-screen and on a half-folded device.
 */
@Composable
private fun useNavigationRail(): Boolean = !LocalFluentAdaptation.current.isCompact

@Composable
fun TokenMonitorApp(
  hubViewModel: HubViewModel = hiltViewModel(),
  connectionViewModel: ConnectionViewModel = hiltViewModel(),
  preferencesViewModel: PreferencesViewModel = hiltViewModel()
) {
  val navController = rememberNavController()
  val hubState by hubViewModel.state.collectAsStateWithLifecycle()
  // Pause the live stream while the app is backgrounded.
  ActivityForegroundEffect { foreground -> hubViewModel.setForeground(foreground) }
  val connectionState by connectionViewModel.state.collectAsStateWithLifecycle()
  val prefs by preferencesViewModel.preferences.collectAsStateWithLifecycle()
  val snackbarHost = remember { SnackbarHostState() }
  val navBackStack by navController.currentBackStackEntryAsState()
  val currentRoute = navBackStack?.destination?.route
  val showGlobalNav = currentRoute in FluentDestinations.routes
  val colors = LocalFluentColors.current

  LaunchedEffect(hubState.error) {
    hubState.error?.let {
      snackbarHost.showSnackbar(it)
      hubViewModel.dismissError()
    }
  }
  LaunchedEffect(connectionState.message) {
    connectionState.message?.let { snackbarHost.showSnackbar(it) }
  }

  // An incomplete connection cannot render any data page, so route to settings
  // rather than showing an empty dashboard.
  LaunchedEffect(connectionState.loading, connectionState.hubUrl, connectionState.secret, currentRoute) {
    if (connectionState.loading) return@LaunchedEffect
    val incomplete = connectionState.hubUrl.isBlank() || connectionState.secret.isBlank()
    if (incomplete && currentRoute != null && currentRoute != "settings") {
      navController.navigate("settings") { launchSingleTop = true }
    }
  }

  val navigateHome: () -> Unit = {
    navController.navigate("overview") {
      popUpTo(navController.graph.findStartDestination().id) { saveState = true }
      launchSingleTop = true
      restoreState = true
    }
  }

  val selectDestination: (FluentDestination) -> Unit = { destination ->
    navController.navigate(destination.route) {
      popUpTo(navController.graph.findStartDestination().id) { saveState = true }
      launchSingleTop = true
      restoreState = true
    }
  }

  // Scaffold owns the snackbar layer and its insets; the global nav lives in its
  // bottomBar slot on compact windows and as a leading rail on medium+. Keeping
  // the bar in the slot (rather than a hand-stacked Column) is what stops the
  // snackbar from landing on top of it.
  // One measurement, one truth: the content area is measured here and handed down as
  // the width class, so the rail decision, the reading-width cap and every adaptive
  // component all agree — and all of them are correct in split-screen.
  BoxWithConstraints(Modifier.fillMaxSize()) {
  val baseAdaptation = LocalFluentAdaptation.current
  val adaptation = remember(maxWidth) { baseAdaptation.measuredAgainst(maxWidth) }
  val rail = !adaptation.isCompact
  CompositionLocalProvider(LocalFluentAdaptation provides adaptation) {
  // One currency for the whole tree: the preference plus the Hub's live rate block.
  val displayFx = remember(prefs.currency, hubState.rates) {
    DisplayFx(currency = prefs.currency.code, rates = hubState.rates)
  }
  CompositionLocalProvider(LocalDisplayFx provides displayFx) {
  Scaffold(
    containerColor = colors.neutralBackground1,
    contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0, 0, 0, 0),
    snackbarHost = { FluentSnackbar(snackbarHost) },
    bottomBar = {
      if (showGlobalNav && !rail) {
        FluentNavBar(
          destinations = FluentDestinations.all,
          currentRoute = currentRoute,
          onSelect = selectDestination
        )
      }
    }
  ) { barInsets ->
    val hostModifier = Modifier.fillMaxSize().padding(bottom = barInsets.calculateBottomPadding())
    if (rail) {
      Row(Modifier.fillMaxSize()) {
        if (showGlobalNav) {
          FluentNavRail(
            destinations = FluentDestinations.all,
            currentRoute = currentRoute,
            onSelect = selectDestination
          )
        }
        // Centre the reading column on very wide windows instead of stretching it.
        Box(
          Modifier
            .weight(1f)
            .fillMaxSize(),
          contentAlignment = Alignment.TopCenter
        ) {
          AppNavHost(
            navController = navController,
            hubState = hubState,
            connectionState = connectionState,
            hubViewModel = hubViewModel,
            connectionViewModel = connectionViewModel,
            navigateHome = navigateHome,
            modifier = hostModifier.contentWidthCapped()
          )
        }
      }
    } else {
      Box(
        hostModifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
      ) {
        AppNavHost(
          navController = navController,
          hubState = hubState,
          connectionState = connectionState,
          hubViewModel = hubViewModel,
          connectionViewModel = connectionViewModel,
          navigateHome = navigateHome,
          modifier = Modifier.contentWidthCapped()
        )
      }
    }
  }
  }
  }
  }
}

/** Fluent toast surface: inverse colours, 8px radius, no Material action tint. */
@Composable
private fun FluentSnackbar(state: SnackbarHostState) {
  val colors = LocalFluentColors.current
  SnackbarHost(state) { data ->
    Row(
      Modifier
        .padding(FluentSpacingDefaults.l)
        .shadow(FluentElevationDefaults.level8, FluentShapeDefaults.cardCorner, clip = false)
        .clip(FluentShapeDefaults.cardCorner)
        .background(colors.inverseBackground)
        .padding(horizontal = FluentSpacingDefaults.l, vertical = FluentSpacingDefaults.m),
      verticalAlignment = Alignment.CenterVertically
    ) {
      Text(
        data.visuals.message,
        style = FluentTypeRamp.body2,
        color = colors.inverseForeground
      )
    }
  }
}

/**
 * Cap the reading width on very large windows instead of stretching a single column
 * across the whole thing.
 *
 * This used to re-measure the window inside the modifier — a second source of truth
 * beside `FluentAdaptation`, one that disagreed with it in split-screen and did not
 * account for the rail's own 84 dp.  A max-width plus the parent's `TopCenter`
 * alignment gets the same result with nothing to keep in sync.
 */
private val ModifierContentMaxWidth = ContentMaxWidthDp

@Composable
private fun Modifier.contentWidthCapped(): Modifier = this.widthIn(max = ModifierContentMaxWidth)


@Composable
private fun AppNavHost(
  navController: NavHostController,
  hubState: HubUiState,
  connectionState: ConnectionUiState,
  hubViewModel: HubViewModel,
  connectionViewModel: ConnectionViewModel,
  navigateHome: () -> Unit,
  modifier: Modifier = Modifier
) {
  // Read the flag here: the transition lambdas below are not composable scope,
  // so a CompositionLocal cannot be read from inside them.
  val motion = fluentMotionEnabled()
  NavHost(
    navController = navController,
    startDestination = "overview",
    modifier = modifier,
    // Tab switches slide laterally; drill-ins rise from the bottom. Splitting
    // these two grammars is what makes the hierarchy legible — Fluent reserves
    // vertical motion for "a new layer was pushed".
    // Respect the platform animation-scale / reduce-motion setting: the content
    // still swaps correctly, it simply does not travel.
    enterTransition = {
      if (!motion) EnterTransition.None
      else if (isTabSwitch(initialState.destination?.route, targetState.destination?.route)) fluentTabEnter()
      else fluentContentPushEnter()
    },
    exitTransition = {
      if (!motion) ExitTransition.None
      else if (isTabSwitch(initialState.destination?.route, targetState.destination?.route)) fluentTabExit()
      else fluentContentPushExit()
    },
    popEnterTransition = {
      if (!motion) EnterTransition.None
      else if (isTabSwitch(initialState.destination?.route, targetState.destination?.route)) fluentTabEnter()
      else fluentContentPopEnter()
    },
    popExitTransition = {
      if (!motion) ExitTransition.None
      else if (isTabSwitch(initialState.destination?.route, targetState.destination?.route)) fluentTabExit()
      else fluentContentPopExit()
    }
  ) {
    composable("overview") {
      OverviewScreen(
        state = hubState,
        onRefresh = hubViewModel::refreshAll,
        onOpenAnalytics = { navController.navigate("analytics") },
        onOpenDevices = { navController.navigate("devices") },
        onOpenSettings = { navController.navigate("settings") },
        onSelectPeriod = hubViewModel::setAnalyticsPeriod,
        onOpenLimits = { navController.navigate("status") },
        hubViewModel = hubViewModel
      )
    }
    composable("analytics") {
      AnalyticsScreen(state = hubState, viewModel = hubViewModel, navController = navController)
    }
    composable("devices") {
      DevicesScreen(hubState.devices, navController, isLoading = hubState.isLoading)
    }
    composable("more") {
      MoreHubScreen(navController, hubState)
    }
    composable("sessions") {
      SessionsScreen(hubState.stats, navController, onHome = navigateHome)
    }
    composable("status") {
      StatusScreen(
        stats = hubState.stats,
        onBack = { navController.popBackStack() },
        onHome = navigateHome
      )
    }
    composable("projects") {
      ProjectsScreen(
        stats = hubState.stats,
        onBack = { navController.popBackStack() },
        onHome = navigateHome
      )
    }
    composable("accounts") {
      AccountsScreen(
        state = hubState,
        viewModel = hubViewModel,
        onBack = { navController.popBackStack() },
        onHome = navigateHome
      )
    }
    composable("subscriptions") {
      SubscriptionsScreen(
        state = hubState,
        viewModel = hubViewModel,
        onBack = { navController.popBackStack() },
        onHome = navigateHome
      )
    }
    composable("pricing") {
      PricingScreen(
        state = hubState,
        viewModel = hubViewModel,
        onBack = { navController.popBackStack() },
        onHome = navigateHome
      )
    }
    composable("settings") {
      SettingsScreen(
        state = connectionState,
        viewModel = connectionViewModel,
        // Saving a connection must reset Hub-derived state: restartRealtime
        // alone kept the previous Hub's stats/devices/history on screen.
        restartRealtime = hubViewModel::onConnectionChanged,
        hubRates = hubState.rates,
        hubRatesDate = hubState.ratesDate,
        onHome = navigateHome,
        onBack = {
          if (!navController.popBackStack()) {
            navController.navigate("overview") { launchSingleTop = true }
          }
        }
      )
    }
    composable("session/{key}") { backStack ->
      SessionDetailScreen(
        stats = hubState.stats,
        key = Uri.decode(backStack.arguments?.getString("key").orEmpty()),
        onBack = { navController.popBackStack() },
        onHome = navigateHome
      )
    }
    composable("device/{id}") { backStack ->
      val id = Uri.decode(backStack.arguments?.getString("id").orEmpty())
      DeviceDetailScreen(
        device = hubState.devices.firstOrNull { it.deviceId == id },
        onBack = { navController.popBackStack() },
        onHome = navigateHome,
        hubState = hubState,
        canManage = hubState.authorization?.scopes?.contains("admin") == true,
        onRenameDevice = hubViewModel::renameDevice,
        onDeleteDevice = hubViewModel::deleteDevice
      )
      // Ask for the device's own history once, when the page opens.
      LaunchedEffect(id) {
        if (hubState.authorization?.scopes?.contains("admin") != null) {
          hubViewModel.refreshDeviceHistory(id)
        }
      }
    }
    composable("client/{id}") { backStack ->
      val id = Uri.decode(backStack.arguments?.getString("id").orEmpty())
      ClientDetailScreen(
        clientId = id,
        state = hubState,
        onBack = { navController.popBackStack() },
        onHome = navigateHome
      )
    }
    composable("model/{id}") { backStack ->
      val id = Uri.decode(backStack.arguments?.getString("id").orEmpty())
      ModelDetailScreen(
        modelId = id,
        state = hubState,
        onBack = { navController.popBackStack() },
        onHome = navigateHome
      )
    }
  }
}

/**
 * True when a transition moves between two primary tabs.  Both endpoints must be
 * tab routes: that is exactly the case where the global nav bar stays mounted and
 * the motion should read as lateral rather than depth.
 */
private fun isTabSwitch(from: String?, to: String?): Boolean =
  from in FluentDestinations.routes && to in FluentDestinations.routes
