package com.igng.tokenmonitor.android.data.remote

import com.igng.tokenmonitor.android.data.local.ConnectionConfig
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HubApiFactory private constructor(
  private val json: Json,
  private val requestTimeoutMs: Long,
  private val allowInsecureHttp: Boolean
) {
  @Inject constructor(json: Json) : this(json, 20_000L, false)

  fun create(config: ConnectionConfig): HubApi = Retrofit.Builder()
    .baseUrl(checkedUrl(config.hubUrl))
    .client(client(config, eventStream = false))
    .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
    .build()
    .create(HubApi::class.java)

  fun eventSource(config: ConnectionConfig, request: Request, listener: EventSourceListener): EventSource =
    EventSources.createFactory(client(config, eventStream = true)).newEventSource(request, listener)

  fun statsRequest(config: ConnectionConfig): Request = Request.Builder()
    .url("${checkedUrl(config.hubUrl)}api/stats/stream")
    .header("Accept", "text/event-stream")
    .build()

  private fun client(config: ConnectionConfig, eventStream: Boolean): OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(requestTimeoutMs, TimeUnit.MILLISECONDS)
    .readTimeout(if (eventStream) 0 else requestTimeoutMs, TimeUnit.MILLISECONDS)
    .addInterceptor { chain ->
      val request = chain.request().newBuilder().apply {
        if (config.secret.isNotBlank()) header("Authorization", "Bearer ${config.secret}")
      }.build()
      chain.proceed(request)
    }
    .build()

  companion object {
    /**
     * Bare host / IP / host:port → http://… for convenience.
     * Existing http(s) schemes are preserved. Always ends with '/'.
     */
    fun normalizeUrl(raw: String): String {
      val value = raw.trim()
      require(value.isNotEmpty()) { "Hub URL is required" }
      val withScheme = when {
        value.startsWith("http://", ignoreCase = true) || value.startsWith("https://", ignoreCase = true) -> value
        else -> "http://$value"
      }
      return if (withScheme.endsWith('/')) withScheme else "$withScheme/"
    }

    fun forTesting(json: Json, requestTimeoutMs: Long = 100L): HubApiFactory = HubApiFactory(json, requestTimeoutMs, true)
  }

  private fun normalizeUrl(raw: String): String = Companion.normalizeUrl(raw)

  private fun checkedUrl(raw: String): String {
    val normalized = normalizeUrl(raw)
    require(allowInsecureHttp || normalized.startsWith("https://", ignoreCase = true)) {
      "Android 客户端只允许 HTTPS Hub；请为 LAN/VPN Hub 配置 TLS。"
    }
    return normalized
  }
}
