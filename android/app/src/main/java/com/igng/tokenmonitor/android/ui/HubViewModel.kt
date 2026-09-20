package com.igng.tokenmonitor.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.igng.tokenmonitor.android.data.model.BatchPricingResponseDto
import com.igng.tokenmonitor.android.data.model.DeviceDto
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

/** Preset windows for share analytics; Custom uses hub /api/usage/range. */
enum class AnalyticsPeriodKind { Today, Month, AllTime, Custom }

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
      customRangeLoading = false
    )
  }

  fun loadCustomRange(
    startDate: String,
    endDate: String,
    startHour: Int = 0,
    endHour: Int = 23,
    label: String? = null
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
        analyticsPeriod = AnalyticsPeriodKind.Custom,
        customRange = selection,
        customRangeLoading = true,
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
      AnalyticsPeriodKind.Custom -> state.customRangeResult?.toPeriodDto()
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

  fun clientsForModel(modelId: String): Pair<Map<String, Long>, Map<String, Double>> {
    val state = _state.value
    val range = state.customRangeResult ?: return emptyMap<String, Long>() to emptyMap()
    val tokens = linkedMapOf<String, Long>()
    val costs = linkedMapOf<String, Double>()
    for ((client, models) in range.clientModels) {
      val t = models[modelId] ?: continue
      tokens[client] = t
      costs[client] = range.clientModelCosts[client]?.get(modelId) ?: 0.0
    }
    return tokens to costs
  }

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
              event.stats?.let { _state.value = _state.value.copy(stats = it, realtime = RealtimeStatus.Live, error = null) }
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
}

private fun UsageRangeDto.toPeriodDto(): PeriodDto = PeriodDto(
  totalTokens = totalTokens,
  costUsd = costUsd,
  clients = clients,
  clientCosts = clientCosts,
  models = models,
  modelCosts = modelCosts,
  clientModels = clientModels,
  clientModelCosts = clientModelCosts,
  projects = projects,
  sessions = sessions
)

fun formatRangeLabel(startDate: String, endDate: String, startHour: Int, endHour: Int): String {
  fun pad(n: Int) = n.toString().padStart(2, '0')
  val start = "$startDate ${pad(startHour)}:00"
  val end = "$endDate ${pad(endHour)}:00"
  return "$start → $end"
}
