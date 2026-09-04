package com.igng.tokenmonitor.android.data.model

import kotlinx.serialization.Serializable

@Serializable
data class HealthDto(
  val ok: Boolean = false,
  val role: String? = null,
  val version: Int? = null,
  val apiVersion: Int? = null,
  val capabilities: HubCapabilitiesDto = HubCapabilitiesDto(),
  val authenticatedRole: String? = null,
  val grantedScopes: List<String> = emptyList(),
  val deviceCount: Int? = null,
  val secretRequired: Boolean? = null,
  val now: String? = null
)

@Serializable
data class HubCapabilitiesDto(
  val stats: Boolean = true,
  val history: Boolean = true,
  val statsStream: Boolean = true,
  val subscriptions: Boolean = true,
  val usageRange: Boolean = false,
  val pricing: Boolean = false,
  val deviceDelete: Boolean = false,
  val deviceRename: Boolean = false,
  val publicStats: Boolean = false
)

@Serializable
data class HubAuthorizationDto(
  val apiVersion: Int? = null,
  val capabilities: HubCapabilitiesDto = HubCapabilitiesDto(),
  val role: String? = null,
  val scopes: List<String> = emptyList()
)

@Serializable
data class StatsDto(
  val staleAfterMs: Long? = null,
  val periods: PeriodsDto = PeriodsDto(),
  val devices: List<DeviceDto> = emptyList(),
  val projectsIncomplete: Boolean? = null,
  val historyPreview: HistoryDto? = null,
  val limits: LimitsDto? = null
)

@Serializable
data class HistoryBreakdownDto(
  val tokens: Double = 0.0,
  val cost: Double = 0.0,
  val messages: Double = 0.0
)

@Serializable
data class HistoryDayDto(
  val date: String = "",
  val tokens: Double = 0.0,
  val cost: Double = 0.0,
  val activeTimeMs: Double = 0.0,
  val perClient: Map<String, HistoryBreakdownDto> = emptyMap(),
  val perModel: Map<String, HistoryBreakdownDto> = emptyMap()
)

@Serializable
data class HistoryMonthDto(
  val month: String = "",
  val tokens: Double = 0.0,
  val cost: Double = 0.0,
  val activeTimeMs: Double = 0.0,
  val perClient: Map<String, HistoryBreakdownDto> = emptyMap(),
  val perModel: Map<String, HistoryBreakdownDto> = emptyMap()
)

/** Full /api/history payload (includes perClient/perModel stacks). */
@Serializable
data class HistoryDto(
  val daily: List<HistoryDayDto> = emptyList(),
  val monthly: List<HistoryMonthDto> = emptyList(),
  val summary: HistorySummaryDto = HistorySummaryDto()
)

typealias HistoryPreviewDto = HistoryDto

@Serializable
data class HistorySummaryDto(
  val totalTokens: Double = 0.0,
  val totalCost: Double = 0.0,
  val activeDays: Double = 0.0,
  val currentStreak: Double = 0.0,
  val longestStreak: Double = 0.0,
  val peakDayTokens: Double = 0.0,
  val favoriteModel: String? = null,
  val messages: Double = 0.0,
  val activeTimeMs: Double = 0.0
)

@Serializable
data class LimitsDto(
  val updatedAt: String? = null,
  val refreshMs: Long? = null,
  val providers: List<LimitProviderDto> = emptyList()
)

@Serializable
data class LimitProviderDto(
  val provider: String = "",
  val accountKey: String? = null,
  val accountEmail: String? = null,
  val accountLabel: String? = null,
  val accountName: String? = null,
  val plan: String? = null,
  val planType: String? = null,
  val planLabel: String? = null,
  val workspaceKind: String? = null,
  val status: String? = null,
  val source: String? = null,
  val updatedAt: String? = null,
  val balanceUsd: Double? = null,
  val balance: BalanceDto? = null,
  val resetCredits: ResetCreditsDto? = null,
  val windows: List<LimitWindowDto> = emptyList()
)

@Serializable
data class BalanceDto(
  val amount: Double? = null,
  val currency: String? = null,
  val todaySpend: Double? = null,
  val weekSpend: Double? = null,
  val monthSpend: Double? = null,
  val allTimeSpend: Double? = null
)

@Serializable
data class ResetCreditsDto(
  val availableCount: Double? = null,
  val totalCount: Double? = null,
  val available: Double? = null,
  val total: Double? = null,
  val remaining: Double? = null,
  val limit: Double? = null
)

@Serializable
data class LimitWindowDto(
  val kind: String = "",
  val label: String? = null,
  val used: Double? = null,
  val limit: Double? = null,
  val remaining: Double? = null,
  val usedPercent: Double? = null,
  val remainingPercent: Double? = null,
  val resetsAt: String? = null,
  val windowMinutes: Double? = null,
  val resetDescription: String? = null,
  val metric: String? = null,
  val detail: String? = null,
  val showMeter: Boolean = true
)

@Serializable
data class PeriodsDto(
  val today: PeriodDto = PeriodDto(),
  val month: PeriodDto = PeriodDto(),
  val allTime: PeriodDto = PeriodDto()
)

@Serializable
data class PeriodDto(
  val totalTokens: Long = 0,
  val costUsd: Double = 0.0,
  val clients: Map<String, Long> = emptyMap(),
  val clientCosts: Map<String, Double> = emptyMap(),
  val models: Map<String, Long> = emptyMap(),
  val modelCosts: Map<String, Double> = emptyMap(),
  val clientModels: Map<String, Map<String, Long>> = emptyMap(),
  val clientModelCosts: Map<String, Map<String, Double>> = emptyMap(),
  val projects: Map<String, ProjectDto> = emptyMap(),
  val sessions: Map<String, SessionDto> = emptyMap()
)

@Serializable
data class ProjectDto(
  val label: String? = null,
  val tokens: Long = 0,
  val costUsd: Double = 0.0,
  val clients: Map<String, Long> = emptyMap()
)

@Serializable
data class SessionDto(
  val client: String? = null,
  val sessionId: String? = null,
  val projectId: String? = null,
  val projectLabel: String? = null,
  val totalTokens: Long = 0,
  val costUsd: Double = 0.0,
  val messageCount: Long = 0,
  val inputTokens: Long = 0,
  val outputTokens: Long = 0,
  val cacheReadTokens: Long = 0,
  val cacheWriteTokens: Long = 0,
  val reasoningTokens: Long = 0,
  val startedAt: String? = null,
  val lastUsedAt: String? = null,
  val models: Map<String, Long> = emptyMap()
)

@Serializable
data class DeviceDto(
  val deviceId: String? = null,
  val hostname: String? = null,
  val platform: String? = null,
  val osName: String? = null,
  val osVersion: String? = null,
  val agentRuntime: String? = null,
  val updatedAt: String? = null,
  val receivedAt: String? = null,
  val stale: Boolean = false,
  val clientStatus: Map<String, String> = emptyMap(),
  val wslStatus: WslStatusDto? = null,
  val periods: PeriodsDto = PeriodsDto(),
  val limits: LimitsDto? = null
)

@Serializable
data class WslStatusDto(
  val state: String? = null,
  val detected: List<String> = emptyList(),
  val withData: List<String> = emptyList()
)

@Serializable
data class DevicesResponseDto(val devices: List<DeviceDto> = emptyList())

@Serializable
data class PricingDto(
  val id: Long? = null,
  val model: String = "",
  val inputPricePerMillion: Double = 0.0,
  val outputPricePerMillion: Double = 0.0,
  val cacheReadPricePerMillion: Double = 0.0,
  val cacheWritePricePerMillion: Double = 0.0,
  val source: String = "manual",
  val updatedAt: String? = null
)

@Serializable
data class PricingListDto(val pricing: List<PricingDto> = emptyList())

@Serializable
data class PricingRequestDto(
  val inputPricePerMillion: Double,
  val outputPricePerMillion: Double,
  val cacheReadPricePerMillion: Double,
  val cacheWritePricePerMillion: Double
)

@Serializable
data class PricingResponseDto(val ok: Boolean = false, val pricing: PricingDto? = null)

@Serializable
data class BatchPricingResponseDto(val results: List<BatchPricingResultDto> = emptyList())

@Serializable
data class BatchPricingResultDto(
  val model: String = "",
  val ok: Boolean = false,
  val pricing: PricingDto? = null,
  val error: String? = null,
  val message: String? = null
)

@Serializable
data class UsageRangeDto(
  val from: String = "",
  val to: String = "",
  val startDate: String? = null,
  val endDate: String? = null,
  val startHour: Int? = null,
  val endHour: Int? = null,
  val source: String = "",
  val totalTokens: Long = 0,
  val costUsd: Double = 0.0,
  val clients: Map<String, Long> = emptyMap(),
  val clientCosts: Map<String, Double> = emptyMap(),
  val models: Map<String, Long> = emptyMap(),
  val modelCosts: Map<String, Double> = emptyMap(),
  val clientModels: Map<String, Map<String, Long>> = emptyMap(),
  val clientModelCosts: Map<String, Map<String, Double>> = emptyMap(),
  val projects: Map<String, ProjectDto> = emptyMap(),
  val sessions: Map<String, SessionDto> = emptyMap()
)

@Serializable
data class SseStatsDto(
  val type: String? = null,
  val reason: String? = null,
  val stats: StatsDto? = null,
  val at: String? = null
)
