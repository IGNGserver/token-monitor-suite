package com.igng.tokenmonitor.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.igng.tokenmonitor.android.data.model.BatchPricingResponseDto
import com.igng.tokenmonitor.android.data.model.DeviceDto
import com.igng.tokenmonitor.android.data.model.AccountRequestDto
import com.igng.tokenmonitor.android.data.model.HubAccountDto
import com.igng.tokenmonitor.android.data.model.OAuthExchangeRequestDto
import com.igng.tokenmonitor.android.data.model.OAuthStartDto
import com.igng.tokenmonitor.android.data.model.SubscriptionDto
import com.igng.tokenmonitor.android.data.model.SubscriptionsRequestDto
import com.igng.tokenmonitor.android.data.model.HistoryDto
import com.igng.tokenmonitor.android.data.model.HubAuthorizationDto
import com.igng.tokenmonitor.android.data.model.PeriodDto
import com.igng.tokenmonitor.android.data.model.PricingDto
import com.igng.tokenmonitor.android.data.model.PricingRequestDto
import com.igng.tokenmonitor.android.data.model.StatsDto
import com.igng.tokenmonitor.android.data.model.UsageRangeDto
import com.igng.tokenmonitor.android.data.repository.HubRepository
import com.igng.tokenmonitor.android.data.repository.HubResult
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class RealtimeStatus { Live, Reconnecting, Disconnected }

/**
 * How long a failed range window stays quiet before a snapshot frame may ask again.
 *
 * The retry has to exist (a preset that failed once must recover on its own after
 * midnight), but it must not turn into a poll: in the desktop's local mode a range
 * request runs a full tokscale scan, and the same window will keep failing for the same
 * reason.  The shared UI backs off for the same interval (`PRESET_RANGE_RETRY_MS`).
 */
private const val RANGE_RETRY_MS = 30_000L

/**
 * Scope tabs in the analytics screen.
 *
 * `Today` / `Month` / `AllTime` are the three windows the collector puts on the wire,
 * read straight off the snapshot.  `Yesterday` and `Week` are *calendar* windows the
 * client computes (see `ui/core/DateRanges.kt`) and resolves through
 * `/api/usage/range`, exactly like a hand-picked range does — which is why they land in
 * `customRangeResult` rather than widening the wire shape.  `Custom` is the picked
 * range itself.  The set mirrors the shared web UI's `PERIOD_TABS`.
 */
enum class AnalyticsPeriodKind {
  Today, Yesterday, Week, Month, AllTime, Custom;

  /** Resolved through the range endpoint instead of the snapshot. */
  val needsRange: Boolean get() = this == Yesterday || this == Week || this == Custom
}

data class CustomRangeSelection(
  val startDate: String,
  val endDate: String,
  val startHour: Int,
  val endHour: Int,
  val label: String
)

data class HubUiState(
  val stats: StatsDto? = null,
  val history: HistoryDto? = null,
  val devices: List<DeviceDto> = emptyList(),
  val authorization: HubAuthorizationDto? = null,
  val pricing: List<PricingDto> = emptyList(),
  val isLoading: Boolean = false,
  val isRefreshing: Boolean = false,
  val error: String? = null,
  val realtime: RealtimeStatus = RealtimeStatus.Disconnected,
  val batchResult: BatchPricingResponseDto? = null,
  val analyticsPeriod: AnalyticsPeriodKind = AnalyticsPeriodKind.Today,
  val customRange: CustomRangeSelection? = null,
  val customRangeResult: UsageRangeDto? = null,
  val customRangeLoading: Boolean = false,
  /**
   * The calendar window a `Yesterday` / `Week` tab last resolved.  Kept separately
   * from [customRange] because a preset must be *re-resolved* when the date rolls
   * over — yesterday becomes today's yesterday — whereas a picked range is fixed and
   * stays whatever the user chose.
   */
  val activePresetWindow: com.igng.tokenmonitor.android.ui.core.PresetRangeWindow? = null,
  /** Hub-owned quota accounts.  Read scope is enough to list them; admin is needed to
   * change them, and the UI gates on [HubAuthorizationDto.scopes] rather than guessing
   * from whether the list came back. */
  val accounts: List<HubAccountDto> = emptyList(),
  val accountsLoading: Boolean = false,
  val accountsError: String? = null,
  /** Pending OAuth sign-in started on the Hub; the user finishes it in a browser. */
  val oauthSession: OAuthStartDto? = null,
  val subscriptions: List<SubscriptionDto> = emptyList(),
  val subscriptionsUpdatedAt: String? = null,
  val subscriptionsError: String? = null,
  /** Display rates from the Hub, so a non-USD currency is the Hub's number, not ours. */
  val rates: Map<String, Double> = emptyMap(),
  val ratesDate: String? = null,
  /**
   * Per-device history from `/api/history?deviceId=`, keyed by device id.  The fleet
   * aggregate in [history] is a different document, so the device detail cannot reuse
   * it; without this the trend the device page could draw was every machine's total.
   */
  val deviceHistories: Map<String, HistoryDto> = emptyMap(),
  /** Set when /api/history failed: trends and model splits fall back to the
   *  narrower historyPreview until it succeeds, so the UI can offer a retry. */
  val historyError: String? = null
)

@HiltViewModel
class HubViewModel @Inject constructor(private val repository: HubRepository) : ViewModel() {
  private val _state = MutableStateFlow(HubUiState())
  val state = _state.asStateFlow()
  private var sseJob: Job? = null
  private var rangeJob: Job? = null
  private var refreshJob: Job? = null
  private var hasObservedForeground = false
  private var statsFrameVersion = 0L

  /**
   * Only the newest range reply may land.  A cancelled job already cannot resume, but
   * the sequence also protects the state write from a response that was already being
   * decoded when the user moved to another scope tab.
   */
  private var rangeSequence = 0
  private var rangeFailedKey = ""
  private var rangeRetryAfterMs = 0L
  private val requestJobs = mutableSetOf<Job>()
  private var connectionGeneration = 0L

  private fun isCurrent(generation: Long) = generation == connectionGeneration

  private fun launchRequest(block: suspend (Long) -> Unit): Job {
    val generation = connectionGeneration
    val job = viewModelScope.launch {
      block(generation)
    }
    requestJobs += job
    job.invokeOnCompletion { requestJobs.remove(job) }
    return job
  }

  private fun cancelRequests() {
    requestJobs.toList().forEach { it.cancel() }
    requestJobs.clear()
  }

  init {
    val generation = connectionGeneration
    // Show the dashboard as soon as its snapshot arrives. Capabilities are useful
    // for optional sections, but a slow capabilities endpoint must not hold up stats.
    refreshAll()
    startRealtime(generation)
    viewModelScope.launch {
      when (val result = repository.capabilities()) {
        is HubResult.Success -> if (isCurrent(generation)) {
          _state.value = _state.value.copy(authorization = result.value)
          if (result.value.capabilities.pricing) refreshPricing()
          if (result.value.capabilities.hubAccounts != false) refreshAccounts()
        }
        is HubResult.Failure -> if (isCurrent(generation)) {
          _state.value = _state.value.copy(error = result.error.message)
        }
      }
    }
  }

  fun refreshAll() {
    if (refreshJob?.isActive == true) return
    val generation = connectionGeneration
    _state.value = _state.value.copy(isLoading = _state.value.stats == null, isRefreshing = true)
    val jobs = mutableListOf(refreshStats(), refreshHistory(), refreshRates())
    // /api/stats already carries the same device list. An extra /api/devices call
    // duplicates Hub aggregation and competes with the first useful response.
    if (_state.value.authorization?.capabilities?.pricing == true) jobs += refreshPricing()
    if (_state.value.authorization?.capabilities?.hubAccounts != false && _state.value.authorization != null) jobs += refreshAccounts()
    refreshJob = viewModelScope.launch {
      jobs.forEach { it.join() }
      if (isCurrent(generation)) _state.value = _state.value.copy(isRefreshing = false)
    }
    val current = _state.value
    if (current.analyticsPeriod == AnalyticsPeriodKind.Custom && current.customRange != null) {
      val range = current.customRange
      loadCustomRange(range.startDate, range.endDate, range.startHour, range.endHour, range.label)
    } else {
      // A preset is a window, not a stored period: coming back to the app after midnight
      // must re-resolve it, or 昨日/本周 keep answering a span they no longer name.
      refreshPendingRangeWindow()
    }
  }

  fun refreshHistory() = launchRequest { generation ->
    when (val result = repository.history()) {
      is HubResult.Success -> if (isCurrent(generation)) {
        _state.value = _state.value.copy(history = result.value, historyError = null)
      }
      is HubResult.Failure -> if (isCurrent(generation)) {
        // Not fatal to the dashboard, but the fallback (historyPreview) carries no
        // per-client/per-model stacks and is capped at 30 days, so trends and the
        // client model split stay degraded until this succeeds. Record it so the
        // UI can offer a retry instead of silently showing less.
        _state.value = _state.value.copy(historyError = result.error.message)
      }
    }
  }

  fun refreshStats() = launchRequest { generation ->
    if (!isCurrent(generation)) return@launchRequest
    val frameVersion = statsFrameVersion
    _state.value = _state.value.copy(isLoading = true, error = null)
    when (val result = repository.stats()) {
      is HubResult.Success -> if (isCurrent(generation)) {
        if (frameVersion == statsFrameVersion) {
          _state.value = _state.value.copy(
            stats = result.value,
            devices = result.value.devices,
            isLoading = false
          )
        } else {
          _state.value = _state.value.copy(isLoading = false)
        }
      }
      is HubResult.Failure -> if (isCurrent(generation)) {
        _state.value = _state.value.copy(
          isLoading = false,
          error = if (frameVersion == statsFrameVersion) result.error.message else _state.value.error
        )
      }
    }
  }

  fun refreshDevices() = launchRequest { generation ->
    when (val result = repository.devices()) {
      is HubResult.Success -> if (isCurrent(generation)) {
        _state.value = _state.value.copy(devices = result.value.devices)
      }
      is HubResult.Failure -> if (isCurrent(generation)) {
        _state.value = _state.value.copy(error = result.error.message)
      }
    }
  }

  fun refreshPricing() = launchRequest { generation ->
    if (_state.value.authorization?.capabilities?.pricing != true) return@launchRequest
    when (val result = repository.pricing()) {
      is HubResult.Success -> if (isCurrent(generation)) {
        _state.value = _state.value.copy(pricing = result.value.pricing, error = null)
      }
      is HubResult.Failure -> if (isCurrent(generation)) {
        _state.value = _state.value.copy(error = result.error.message)
      }
    }
  }

  fun savePricing(model: String, request: PricingRequestDto) = launchRequest { generation ->
    if (_state.value.authorization?.scopes?.contains("admin") != true) return@launchRequest
    when (val result = repository.putPricing(model, request)) {
      is HubResult.Success -> if (isCurrent(generation)) refreshPricing()
      is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(error = result.error.message)
    }
  }

  fun fetchUpstream(model: String) = launchRequest { generation ->
    if (_state.value.authorization?.scopes?.contains("admin") != true) return@launchRequest
    when (val result = repository.fetchUpstream(model)) {
      is HubResult.Success -> if (isCurrent(generation)) refreshPricing()
      is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(error = result.error.message)
    }
  }

  fun fetchAllUpstream() = launchRequest { generation ->
    if (_state.value.authorization?.scopes?.contains("admin") != true) return@launchRequest
    when (val result = repository.fetchAllUpstream()) {
      is HubResult.Success -> if (isCurrent(generation)) {
        _state.value = _state.value.copy(batchResult = result.value)
        refreshPricing()
      }
      is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(error = result.error.message)
    }
  }

  /** Reset every Hub-derived field when the connection target changes.
   *
   *  Without this, saving a different Hub URL/secret left the previous Hub's
   *  stats, devices and history on screen (with a live-looking status) until the
   *  new Hub happened to answer — presenting one deployment's numbers as another's.
   */
  fun onConnectionChanged() {
    connectionGeneration += 1
    val generation = connectionGeneration
    rangeJob?.cancel()
    rangeJob = null
    // A different deployment can answer the same window, so a backoff recorded against
    // the previous Hub must not silence the retry on this one.
    rangeSequence += 1
    rangeFailedKey = ""
    rangeRetryAfterMs = 0L
    sseJob?.cancel()
    sseJob = null
    refreshJob?.cancel()
    refreshJob = null
    cancelRequests()
    _state.value = HubUiState(isLoading = true, realtime = RealtimeStatus.Reconnecting)
    refreshAll()
    startRealtime(generation)
    viewModelScope.launch {
      when (val result = repository.capabilities()) {
        is HubResult.Success -> if (isCurrent(generation)) {
          _state.value = _state.value.copy(authorization = result.value)
          if (result.value.capabilities.pricing) refreshPricing()
          if (result.value.capabilities.hubAccounts != false) refreshAccounts()
        }
        is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(error = result.error.message)
      }
    }
  }

  fun clearBatchResult() { _state.value = _state.value.copy(batchResult = null) }
  fun dismissError() { _state.value = _state.value.copy(error = null) }

  fun setAnalyticsPeriod(kind: AnalyticsPeriodKind) {
    if (kind == AnalyticsPeriodKind.Yesterday || kind == AnalyticsPeriodKind.Week) {
      if (_state.value.authorization?.capabilities?.usageRange != true) {
        _state.value = _state.value.copy(error = "当前 Hub 不支持日历预设范围。")
        return
      }
      // Re-selecting a preset that already answers this exact window must not spend a
      // second range request; the window is the identity, not the tab.
      if (ScopePeriod.rangeAnswerIsCurrent(_state.value.copy(analyticsPeriod = kind))) {
        _state.value = _state.value.copy(analyticsPeriod = kind, customRangeLoading = false)
        return
      }
      // Select first, then ask: `retryScopeRange()` derives the window from the kind, so
      // the tab the user chose and the span that answers it cannot drift apart.
      _state.value = _state.value.copy(analyticsPeriod = kind)
      retryScopeRange()
      return
    }
    if (kind == AnalyticsPeriodKind.Custom) {
      if (_state.value.authorization?.capabilities?.usageRange != true) {
        _state.value = _state.value.copy(error = "当前 Hub 不支持自定义时间范围。")
        return
      }
      // Clear any previous range result: the tab renders customRangeResult
      // whenever the period is Custom, so keeping it would show the old range's
      // numbers under the new selection.
      rangeJob?.cancel()
      _state.value = _state.value.copy(
        analyticsPeriod = AnalyticsPeriodKind.Custom,
        customRange = null,
        customRangeResult = null,
        customRangeLoading = false,
        activePresetWindow = null
      )
      return
    }
    rangeJob?.cancel()
    // A snapshot period is *never* answered by a range payload.  Dropping the cached
    // answer here is what stops 今日/本月/全部 from keeping the number of whatever
    // preset was selected last — the overview used to prefer the cache for every tab,
    // so one fetched range silently replaced the whole scope bar.
    _state.value = _state.value.copy(
      analyticsPeriod = kind,
      customRange = null,
      customRangeResult = null,
      customRangeLoading = false,
      activePresetWindow = null
    )
  }

  /**
   * Ask the current scope tab's window again, after a failure or a manual retry.
   *
   * Both surfaces need the same rule, and it has to be the rule that *selected* the
   * window in the first place: a preset re-derives its calendar span (so a retry after
   * midnight asks for today's week), while a picked range re-sends the days the user
   * chose.  Reusing [setAnalyticsPeriod] would not work for `Custom`, which clears the
   * selection and waits for the picker.
   */
  fun retryScopeRange() {
    val current = _state.value
    val kind = current.analyticsPeriod
    if (!kind.needsRange) return
    if (kind == AnalyticsPeriodKind.Custom) {
      val range = current.customRange ?: return
      loadCustomRange(range.startDate, range.endDate, range.startHour, range.endHour, range.label)
      return
    }
    val window = com.igng.tokenmonitor.android.ui.core.DateRanges.presetRangeWindow(kind.presetPeriodName())
      ?: return
    // Tapping the tab that is already being fetched must not spend a second request: the
    // in-flight call already describes this exact window.
    if (_state.value.customRangeLoading && window.stillMatches(_state.value.activePresetWindow)) return
    loadCustomRange(
      startDate = window.startDate.toString(),
      endDate = window.endDate.toString(),
      startHour = window.startHour,
      endHour = window.endHour,
      label = window.label(),
      period = kind,
      presetWindow = window
    )
  }

  /**
   * Re-resolve a preset whose calendar window has moved, and retry one that failed.
   *
   * `Yesterday` and `Week` are windows, not stored periods: after local midnight the
   * cached answer describes a different span, and keeping it would show last week's
   * total under 本周.  [ScopePeriod.pendingRangeWindow] only turns non-null when the
   * window genuinely stopped matching, so calling this on every stream frame costs a
   * date comparison rather than a request — the same rule the shared UI uses
   * (`pendingPresetRangeWindow()` in `src/shared-ui/app.js`), and the reason a preset
   * never re-scans tokscale per tick in local mode.
   */
  private fun refreshPendingRangeWindow(today: java.time.LocalDate = java.time.LocalDate.now()) {
    if (_state.value.authorization?.capabilities?.usageRange != true) return
    if (_state.value.customRangeLoading) return
    val window = ScopePeriod.pendingRangeWindow(_state.value, today) ?: return
    val key = rangeKey(window.startDate.toString(), window.endDate.toString(), window.startHour, window.endHour)
    if (key == rangeFailedKey && System.currentTimeMillis() < rangeRetryAfterMs) return
    retryScopeRange()
  }

  private fun rangeKey(startDate: String, endDate: String, startHour: Int, endHour: Int): String =
    "$startDate:$endDate:$startHour:$endHour"

  fun loadCustomRange(
    startDate: String,
    endDate: String,
    startHour: Int = 0,
    endHour: Int = 23,
    label: String? = null,
    period: AnalyticsPeriodKind = AnalyticsPeriodKind.Custom,
    presetWindow: com.igng.tokenmonitor.android.ui.core.PresetRangeWindow? = null
  ) {
    if (_state.value.authorization?.capabilities?.usageRange != true) {
      _state.value = _state.value.copy(error = "当前 Hub 不支持自定义时间范围。")
      return
    }
    val rangeLabel = label ?: formatRangeLabel(startDate, endDate, startHour, endHour)
    val selection = CustomRangeSelection(startDate, endDate, startHour, endHour, rangeLabel)
    val key = rangeKey(startDate, endDate, startHour, endHour)
    val sequence = ++rangeSequence
    rangeJob?.cancel()
    val generation = connectionGeneration
    // Drop the previous window's answer *before* the request: while this is in flight the
    // tab must render a loading state, not the numbers of the scope the user just left.
    _state.value = _state.value.copy(
      analyticsPeriod = period,
      customRange = selection,
      customRangeResult = null,
      customRangeLoading = true,
      activePresetWindow = presetWindow,
      error = null
    )
    rangeJob = viewModelScope.launch {
      if (!isCurrent(generation)) return@launch
      when (val result = repository.usageRange(startDate, endDate, startHour, endHour)) {
        is HubResult.Success -> if (isCurrent(generation) && sequence == rangeSequence) {
          _state.value = _state.value.copy(
            customRangeResult = result.value,
            customRangeLoading = false
          )
          rangeFailedKey = ""
        }
        is HubResult.Failure -> if (isCurrent(generation) && sequence == rangeSequence) {
          // Keep the failure honest: no result, so the tab shows a retry affordance
          // instead of a number it never obtained.
          _state.value = _state.value.copy(
            customRangeResult = null,
            customRangeLoading = false,
            error = result.error.message
          )
          rangeFailedKey = key
          rangeRetryAfterMs = System.currentTimeMillis() + RANGE_RETRY_MS
        }
      }
    }
  }

  /** Restart the live stream, e.g. after the secret or the Hub target changed. */
  fun restartRealtime() { sseJob?.cancel(); sseJob = null; startRealtime() }

  /** Start or stop the live stream as the app moves between foreground and background.
   *
   *  viewModelScope outlives onStop, so the SSE loop used to keep an authenticated
   *  connection open, answer 15s pings and re-dial on a 1-30s backoff forever while
   *  the app was backgrounded — battery/radio drain and Hub-side connection churn
   *  for a client the user believes is idle.
   */
  fun setForeground(foreground: Boolean) {
    if (foreground) {
      if (hasObservedForeground && sseJob?.isActive != true) refreshAll()
      hasObservedForeground = true
      startRealtime()
    } else {
      sseJob?.cancel()
      sseJob = null
      _state.value = _state.value.copy(realtime = RealtimeStatus.Disconnected)
    }
  }

  private fun startRealtime(generation: Long = connectionGeneration) {
    if (!isCurrent(generation) || sseJob?.isActive == true) return
    sseJob = viewModelScope.launch {
      val configured = try {
        withContext(Dispatchers.IO) { repository.connection().isComplete }
      } catch (error: CancellationException) {
        throw error
      } catch (_: Exception) {
        if (isCurrent(generation)) {
          _state.value = _state.value.copy(
            realtime = RealtimeStatus.Disconnected,
            error = "无法读取本机连接设置，请重新保存连接信息。"
          )
        }
        return@launch
      }
      if (!configured) {
        _state.value = _state.value.copy(realtime = RealtimeStatus.Disconnected)
        return@launch
      }
      var backoffMs = 1_000L
      while (isActive && isCurrent(generation)) {
        _state.value = _state.value.copy(realtime = RealtimeStatus.Reconnecting)
        runCatching {
          repository.statsEvents().collect { event ->
            if (isCurrent(generation)) {
              event.stats?.let { stats ->
              // Keep the device list in step with the stream's latest stale flags.
              // A frame without a device list retains the last REST snapshot.
              val devices = stats.devices.ifEmpty { _state.value.devices }
              statsFrameVersion += 1
              _state.value = _state.value.copy(
                stats = stats,
                devices = devices,
                isLoading = false,
                realtime = RealtimeStatus.Live,
                error = null
              )
              // A snapshot frame is also the clock check for a preset scope tab: past
              // local midnight the cached window no longer names 昨日/本周, so it is
              // re-resolved here.  The predicate is a date comparison unless the window
              // actually moved, so this never turns into a request per frame.
              refreshPendingRangeWindow()
            }
            }
            backoffMs = 1_000L
          }
        }.onFailure {
          if (isActive && isCurrent(generation)) _state.value = _state.value.copy(realtime = RealtimeStatus.Disconnected)
        }
        if (isActive && isCurrent(generation)) {
          _state.value = _state.value.copy(realtime = RealtimeStatus.Reconnecting)
          delay(backoffMs)
          backoffMs = (backoffMs * 2).coerceAtMost(30_000L)
        }
      }
    }
  }
// ─── Accounts (Hub-owned quota credentials) ──────────────────────────────────

  fun refreshAccounts() = launchRequest { generation ->
    _state.value = _state.value.copy(accountsLoading = true, accountsError = null)
    when (val result = repository.accounts()) {
      is HubResult.Success -> if (isCurrent(generation)) _state.value = _state.value.copy(
        accounts = result.value.accounts,
        accountsLoading = false
      )
      is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(
        accountsLoading = false,
        accountsError = result.error.message
      )
    }
  }

  /**
   * Add or update an account.  [credential] is assembled by the caller and dropped
   * here: the Hub never echoes it, so the client must not keep a copy in UI state
   * either.  A response carries the whole redacted list, which is why this assigns
   * rather than appending.
   */
  fun saveAccount(
    accountId: String?,
    provider: String,
    name: String?,
    label: String?,
    enabled: Boolean?,
    credential: kotlinx.serialization.json.JsonObject?
  ) = launchRequest { generation ->
    val request = AccountRequestDto(
      provider = provider,
      name = name?.trim()?.ifEmpty { null },
      label = label?.trim()?.ifEmpty { null },
      enabled = enabled,
      credential = credential?.takeIf { !it.isEmpty() }
    )
    val result = if (accountId == null) {
      repository.addAccount(request)
    } else {
      repository.patchAccount(accountId, request)
    }
    when (result) {
      is HubResult.Success -> if (isCurrent(generation)) _state.value = _state.value.copy(
        accounts = result.value.accounts,
        accountsError = null
      )
      is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(
        accountsError = result.error.message
      )
    }
  }

  fun deleteAccount(accountId: String) = launchRequest { generation ->
    when (val result = repository.deleteAccount(accountId)) {
      is HubResult.Success -> if (isCurrent(generation)) _state.value = _state.value.copy(
        accounts = result.value.accounts,
        accountsError = null
      )
      is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(
        accountsError = result.error.message
      )
    }
  }

  fun refreshAccountQuota(accountId: String) = launchRequest { generation ->
    when (val result = repository.refreshAccount(accountId)) {
      is HubResult.Success -> if (isCurrent(generation)) _state.value = _state.value.copy(
        accounts = result.value.accounts,
        accountsError = null
      )
      is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(
        accountsError = result.error.message
      )
    }
  }

  /** Begin a Hub-side OAuth sign-in.  The caller opens [OAuthStartDto.authUrl]. */
  fun startOAuth(provider: String) = launchRequest { generation ->
    when (val result = repository.startOAuth(provider)) {
      is HubResult.Success -> if (isCurrent(generation)) _state.value = _state.value.copy(
        oauthSession = result.value.takeIf { it.ok && !it.sessionId.isNullOrBlank() },
        accountsError = if (result.value.ok) null else result.value.error
      )
      is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(
        accountsError = result.error.message
      )
    }
  }

  fun clearOAuthSession() { _state.value = _state.value.copy(oauthSession = null) }

  /**
   * Complete the sign-in with whatever the provider handed back.  The field is
   * permissive by contract (callback URL, query string, or bare code), so this forwards
   * the paste verbatim instead of parsing it and getting the third shape wrong.
   */
  fun exchangeOAuth(sessionId: String, pasted: String, name: String?, label: String?) =
    launchRequest { generation ->
      val result = repository.exchangeOAuth(
        OAuthExchangeRequestDto(
          sessionId = sessionId,
          redirectUrl = pasted.trim(),
          name = name?.trim()?.ifEmpty { null },
          label = label?.trim()?.ifEmpty { null }
        )
      )
      when (result) {
        is HubResult.Success -> if (isCurrent(generation)) _state.value = _state.value.copy(
          accounts = result.value.accounts,
          oauthSession = null,
          accountsError = null
        )
        is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(
          accountsError = result.error.message
        )
      }
    }

  // ─── Subscription ledger ────────────────────────────────────────────────────

  fun refreshSubscriptions() = launchRequest { generation ->
    when (val result = repository.subscriptions()) {
      is HubResult.Success -> if (isCurrent(generation)) _state.value = _state.value.copy(
        subscriptions = result.value.subscriptions,
        subscriptionsUpdatedAt = result.value.updatedAt,
        subscriptionsError = null
      )
      is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(
        subscriptionsError = result.error.message
      )
    }
  }

  /**
   * Replace the ledger.  [HubUiState.subscriptionsUpdatedAt] is sent as the
   * compare-and-swap base: a concurrent edit from another client fails loudly instead
   * of being overwritten, which is the only reason the token is kept at all.
   */
  fun saveSubscriptions(next: List<SubscriptionDto>) = launchRequest { generation ->
    val base = _state.value.subscriptionsUpdatedAt
    val result = repository.putSubscriptions(SubscriptionsRequestDto(next, base))
    when (result) {
      is HubResult.Success -> if (isCurrent(generation)) _state.value = _state.value.copy(
        subscriptions = result.value.subscriptions,
        subscriptionsUpdatedAt = result.value.updatedAt,
        subscriptionsError = null
      )
      is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(
        subscriptionsError = result.error.message
      )
    }
  }

  // ─── Display rates ──────────────────────────────────────────────────────────

  /**
   * Per-device history, keyed by device id.  `/api/history?deviceId=` is a separate
   * document from the fleet aggregate, so the device detail needs its own cache
   * instead of re-querying on every recomposition.
   */
  fun refreshDeviceHistory(deviceId: String) = launchRequest { generation ->
    when (val result = repository.history(deviceId)) {
      is HubResult.Success -> if (isCurrent(generation)) _state.value = _state.value.copy(
        deviceHistories = _state.value.deviceHistories + (deviceId to result.value)
      )
      is HubResult.Failure -> Unit
    }
  }

  fun renameDevice(deviceId: String, hostname: String) = launchRequest { generation ->
    when (val result = repository.renameDevice(deviceId, hostname)) {
      is HubResult.Success -> if (isCurrent(generation)) {
        _state.value = _state.value.copy(devices = result.value.devices, error = null)
        refreshStats()
      }
      is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(
        error = result.error.message
      )
    }
  }

  fun deleteDevice(deviceId: String) = launchRequest { generation ->
    when (val result = repository.deleteDevice(deviceId)) {
      is HubResult.Success -> if (isCurrent(generation)) {
        _state.value = _state.value.copy(
          devices = result.value.devices,
          deviceHistories = _state.value.deviceHistories - deviceId,
          error = null
        )
        refreshStats()
      }
      is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(
        error = result.error.message
      )
    }
  }

  fun refreshRates() = launchRequest { generation ->
    when (val result = repository.rates()) {
      is HubResult.Success -> if (isCurrent(generation)) _state.value = _state.value.copy(
        rates = result.value.rates,
        ratesDate = result.value.date
      )
      is HubResult.Failure -> Unit
    }
  }


}

internal fun UsageRangeDto.toPeriodDto(): PeriodDto = PeriodDto(
  totalTokens = totalTokens,
  costUsd = costUsd,
  clients = clients,
  clientCosts = clientCosts,
  models = models,
  modelCosts = modelCosts,
  clientModels = clientModels,
  clientModelCosts = clientModelCosts,
  projects = projects,
  sessions = sessions,
  // Provenance has to survive the fold or a range answer renders an estimate as an
  // exact figure while the same client on a snapshot period renders it with `~`.
  clientEstimated = clientEstimated,
  clientCredits = clientCredits,
  clientModelCredits = clientModelCredits,
  estimated = estimated
)


fun formatRangeLabel(startDate: String, endDate: String, startHour: Int, endHour: Int): String {
  fun pad(n: Int) = n.toString().padStart(2, '0')
  val start = "$startDate ${pad(startHour)}:00"
  val end = "$endDate ${pad(endHour)}:00"
  return "$start → $end"
}
