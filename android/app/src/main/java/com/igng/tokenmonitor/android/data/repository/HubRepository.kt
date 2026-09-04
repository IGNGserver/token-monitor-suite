package com.igng.tokenmonitor.android.data.repository

import com.igng.tokenmonitor.android.data.local.ConnectionConfig
import com.igng.tokenmonitor.android.data.local.ConnectionStorage
import com.igng.tokenmonitor.android.data.model.BatchPricingResponseDto
import com.igng.tokenmonitor.android.data.model.DevicesResponseDto
import com.igng.tokenmonitor.android.data.model.HealthDto
import com.igng.tokenmonitor.android.data.model.HubAuthorizationDto
import com.igng.tokenmonitor.android.data.model.HistoryDto
import com.igng.tokenmonitor.android.data.model.PricingListDto
import com.igng.tokenmonitor.android.data.model.PricingRequestDto
import com.igng.tokenmonitor.android.data.model.PricingResponseDto
import com.igng.tokenmonitor.android.data.model.SseStatsDto
import com.igng.tokenmonitor.android.data.model.StatsDto
import com.igng.tokenmonitor.android.data.model.UsageRangeDto
import com.igng.tokenmonitor.android.data.remote.HubApiFactory
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import retrofit2.HttpException

sealed interface HubResult<out T> {
  data class Success<T>(val value: T) : HubResult<T>
  data class Failure(val error: HubError) : HubResult<Nothing>
}

data class HubError(val message: String, val kind: Kind) {
  enum class Kind { NotConfigured, Unauthorized, Network, MalformedResponse, Api }
}

@Singleton
class HubRepository @Inject constructor(
  private val store: ConnectionStorage,
  private val apiFactory: HubApiFactory,
  private val json: Json
) {
  fun connection(): ConnectionConfig = store.read()
  fun saveConnection(config: ConnectionConfig) = store.save(config)
  fun clearConnection() = store.clear()

  suspend fun testConnection(config: ConnectionConfig): HubResult<HealthDto> = safeCall {
    val api = apiFactory.create(config)
    val health = api.health()
    require(health.ok && health.role.equals("hub", ignoreCase = true)) {
      "地址没有返回可用的 Token Monitor Hub。"
    }
    // /api/health is intentionally public on the Hub, so a health-only check
    // cannot prove that the saved secret can access the protected API.
    api.stats()
    val authorization = api.capabilities()
    health.copy(
      apiVersion = authorization.apiVersion ?: health.apiVersion,
      capabilities = authorization.capabilities,
      authenticatedRole = authorization.role,
      grantedScopes = authorization.scopes
    )
  }
  suspend fun capabilities(): HubResult<HubAuthorizationDto> = withConnection { apiFactory.create(it).capabilities() }
  suspend fun stats(): HubResult<StatsDto> = withConnection { apiFactory.create(it).stats() }
  suspend fun history(): HubResult<HistoryDto> = withConnection { apiFactory.create(it).history() }
  suspend fun devices(): HubResult<DevicesResponseDto> = withConnection { apiFactory.create(it).devices() }
  suspend fun usageRange(
    startDate: String,
    endDate: String,
    startHour: Int = 0,
    endHour: Int = 23
  ): HubResult<UsageRangeDto> =
    withConnection { apiFactory.create(it).usageRange(startDate, endDate, startHour, endHour) }
  suspend fun pricing(): HubResult<PricingListDto> = withConnection { apiFactory.create(it).pricing() }
  suspend fun putPricing(model: String, request: PricingRequestDto): HubResult<PricingResponseDto> = withConnection { apiFactory.create(it).putPricing(model, request) }
  suspend fun fetchUpstream(model: String): HubResult<PricingResponseDto> = withConnection { apiFactory.create(it).fetchUpstream(model) }
  suspend fun fetchAllUpstream(): HubResult<BatchPricingResponseDto> = withConnection { apiFactory.create(it).fetchAllUpstream() }

  fun statsEvents(): Flow<SseStatsDto> = callbackFlow {
    val config = connection()
    if (!config.isComplete) {
      close(IllegalStateException("Hub connection is not configured"))
      return@callbackFlow
    }
    val source = apiFactory.eventSource(config, apiFactory.statsRequest(config), object : EventSourceListener() {
      override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
        runCatching { json.decodeFromString<SseStatsDto>(data) }.onSuccess { trySend(it) }.onFailure { close(it) }
      }

      override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) {
        close(t ?: IOException("SSE closed with HTTP ${response?.code ?: "unknown"}"))
      }
    })
    awaitClose { source.cancel() }
  }

  private suspend fun <T> withConnection(call: suspend (ConnectionConfig) -> T): HubResult<T> {
    val config = connection()
    return if (!config.isComplete) HubResult.Failure(HubError("请先在设置中保存 Hub 地址和共享密钥。", HubError.Kind.NotConfigured))
    else safeCall { call(config) }
  }

  private suspend fun <T> safeCall(call: suspend () -> T): HubResult<T> = try {
    HubResult.Success(call())
  } catch (error: HttpException) {
    val message = when (error.code()) {
      401 -> "未授权：请检查共享密钥。"
      404, 422 -> "请求未完成：${error.response()?.errorBody()?.string().orEmpty().ifBlank { "模型没有可用的上游定价。" }}"
      else -> "Hub 返回 HTTP ${error.code()}。"
    }
    HubResult.Failure(HubError(message, if (error.code() == 401) HubError.Kind.Unauthorized else HubError.Kind.Api))
  } catch (_: SerializationException) {
    HubResult.Failure(HubError("Hub 返回的数据格式无法解析，请确认客户端与 Hub 版本兼容。", HubError.Kind.MalformedResponse))
  } catch (error: IOException) {
    HubResult.Failure(HubError("无法连接 Hub：${error.message ?: "网络不可用"}", HubError.Kind.Network))
  } catch (error: IllegalArgumentException) {
    HubResult.Failure(HubError(error.message ?: "Hub 地址无效。", HubError.Kind.Api))
  }
}
