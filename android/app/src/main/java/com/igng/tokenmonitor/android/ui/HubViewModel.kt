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
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class RealtimeStatus { Live, Reconnecting, Disconnected }

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
    viewModelScope.launch {
      when (val result = repository.capabilities()) {
        is HubResult.Success -> if (isCurrent(generation)) {
          _state.value = _state.value.copy(authorization = result.value)
        }
        is HubResult.Failure -> if (isCurrent(generation)) {
          _state.value = _state.value.copy(error = result.error.message)
        }
      }
      if (!isCurrent(generation)) return@launch
      refreshAll()
      startRealtime(generation)
    }
  }

  fun refreshAll() {
    refreshStats()
    refreshHistory()
    refreshDevices()
    if (_state.value.authorization?.capabilities?.pricing == true) refreshPricing()
    refreshRates()
    if (_state.value.authorization?.capabilities?.hubAccounts != false) refreshAccounts()
    val current = _state.value
    if (current.analyticsPeriod == AnalyticsPeriodKind.Custom && current.customRange != null) {
      val range = current.customRange
      loadCustomRange(range.startDate, range.endDate, range.startHour, range.endHour, range.label)
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
    _state.value = _state.value.copy(isLoading = true, error = null)
    when (val result = repository.stats()) {
      is HubResult.Success -> if (isCurrent(generation)) {
        _state.value = _state.value.copy(stats = result.value, isLoading = false)
      }
      is HubResult.Failure -> if (isCurrent(generation)) {
        _state.value = _state.value.copy(isLoading = false, error = result.error.message, realtime = RealtimeStatus.Disconnected)
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
    sseJob?.cancel()
    sseJob = null
    cancelRequests()
    _state.value = HubUiState(realtime = RealtimeStatus.Reconnecting)
    viewModelScope.launch {
      when (val result = repository.capabilities()) {
        is HubResult.Success -> if (isCurrent(generation)) _state.value = _state.value.copy(authorization = result.value)
        is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(error = result.error.message)
      }
      if (!isCurrent(generation)) return@launch
      refreshAll()
      startRealtime(generation)
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
      val window = com.igng.tokenmonitor.android.ui.core.DateRanges.presetRangeWindow(kind.name.lowercase())
        ?: return
      loadCustomRange(
        startDate = window.startDate.toString(),
        endDate = window.endDate.toString(),
        startHour = window.startHour,
        endHour = window.endHour,
        label = window.label(),
        period = kind,
        presetWindow = window
      )
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
      _state.value = _state.value.copy(
        analyticsPeriod = AnalyticsPeriodKind.Custom,
        customRangeResult = null,
        customRangeLoading = false
      )
      return
    }
    rangeJob?.cancel()
    _state.value = _state.value.copy(
      analyticsPeriod = kind,
      customRangeLoading = false,
      activePresetWindow = null
    )
  }

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
    rangeJob?.cancel()
    val generation = connectionGeneration
    rangeJob = viewModelScope.launch {
      _state.value = _state.value.copy(
        analyticsPeriod = period,
        customRange = selection,
        customRangeLoading = true,
        activePresetWindow = presetWindow,
        error = null
      )
      if (!isCurrent(generation)) return@launch
      when (val result = repository.usageRange(startDate, endDate, startHour, endHour)) {
        is HubResult.Success -> if (isCurrent(generation)) _state.value = _state.value.copy(
          customRangeResult = result.value,
          customRangeLoading = false
        )
        is HubResult.Failure -> if (isCurrent(generation)) _state.value = _state.value.copy(
          customRangeResult = null,
          customRangeLoading = false,
          error = result.error.message
        )
      }
    }
  }

  fun currentSharePeriod(): PeriodDto? {
    val state = _state.value
    return when (state.analyticsPeriod) {
      AnalyticsPeriodKind.Today -> state.stats?.periods?.today
      AnalyticsPeriodKind.Month -> state.stats?.periods?.month
      AnalyticsPeriodKind.AllTime -> state.stats?.periods?.allTime
      AnalyticsPeriodKind.Custom,
      AnalyticsPeriodKind.Yesterday,
      AnalyticsPeriodKind.Week -> state.customRangeResult?.toPeriodDto()
    }
  }

  fun clientModelsFor(clientId: String): Map<String, Long> {
    val state = _state.value
    return when (state.analyticsPeriod) {
      AnalyticsPeriodKind.Custom -> state.customRangeResult?.clientModels?.get(clientId).orEmpty()
      else -> currentSharePeriod()?.clientModels?.get(clientId).orEmpty()
    }
  }

  fun clientModelCostsFor(clientId: String): Map<String, Double> {
    val state = _state.value
    return when (state.analyticsPeriod) {
      AnalyticsPeriodKind.Custom -> state.customRangeResult?.clientModelCosts?.get(clientId).orEmpty()
      else -> currentSharePeriod()?.clientModelCosts?.get(clientId).orEmpty()
    }
  }

  /**
   * Superseded: the model→client split now resolves in `AnalyticsScreen` against the
   * same `clientModels` map the client→model split uses, because this helper covered
   * only the custom-range case and the screen had a second, different rule for the
   * preset periods.
   */

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
      if (sseJob?.isActive != true) refreshAll()
      startRealtime()
    } else {
      sseJob?.cancel()
      sseJob = null
      _state.value = _state.value.copy(realtime = RealtimeStatus.Disconnected)
    }
  }

  private fun startRealtime(generation: Long = connectionGeneration) {
    if (!repository.connection().isComplete) return
    if (!isCurrent(generation) || sseJob?.isActive == true) return
    sseJob = viewModelScope.launch {
      var backoffMs = 1_000L
      while (isActive && isCurrent(generation)) {
        _state.value = _state.value.copy(realtime = RealtimeStatus.Reconnecting)
        runCatching {
          repository.statsEvents().collect { event ->
            if (isCurrent(generation)) {
              event.stats?.let { stats ->
              // One source for the fleet list.  `refreshDevices()` fills it on first
              // load, but `/api/devices` is never re-polled on a stream frame while
              // `stats.devices` carries the same DeviceDto list *and* the fresher
              // `stale` flags — so the overview and device pages were showing a
              // snapshot from the last manual refresh while the status page, which
              // reads `stats.devices`, moved ahead.  Prefer the frame, keep the
              // REST list only until the first frame that carries one.
              val devices = stats.devices.ifEmpty { _state.value.devices }
              _state.value = _state.value.copy(
                stats = stats,
                devices = devices,
                realtime = RealtimeStatus.Live,
                error = null
              )
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

