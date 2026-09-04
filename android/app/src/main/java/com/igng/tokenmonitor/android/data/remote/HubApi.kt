package com.igng.tokenmonitor.android.data.remote

import com.igng.tokenmonitor.android.data.model.BatchPricingResponseDto
import com.igng.tokenmonitor.android.data.model.DevicesResponseDto
import com.igng.tokenmonitor.android.data.model.HealthDto
import com.igng.tokenmonitor.android.data.model.HubAuthorizationDto
import com.igng.tokenmonitor.android.data.model.HistoryDto
import com.igng.tokenmonitor.android.data.model.PricingListDto
import com.igng.tokenmonitor.android.data.model.PricingRequestDto
import com.igng.tokenmonitor.android.data.model.PricingResponseDto
import com.igng.tokenmonitor.android.data.model.StatsDto
import com.igng.tokenmonitor.android.data.model.UsageRangeDto
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface HubApi {
  @GET("api/health") suspend fun health(): HealthDto
  @GET("api/capabilities") suspend fun capabilities(): HubAuthorizationDto
  @GET("api/stats") suspend fun stats(): StatsDto
  @GET("api/history") suspend fun history(): HistoryDto
  @GET("api/devices") suspend fun devices(): DevicesResponseDto
  @GET("api/usage/range") suspend fun usageRange(
    @Query("startDate") startDate: String,
    @Query("endDate") endDate: String,
    @Query("startHour") startHour: Int = 0,
    @Query("endHour") endHour: Int = 23
  ): UsageRangeDto
  @GET("api/pricing") suspend fun pricing(): PricingListDto
  @PUT("api/pricing/{model}") suspend fun putPricing(@Path("model") model: String, @Body request: PricingRequestDto): PricingResponseDto
  @POST("api/pricing/{model}/fetch-upstream") suspend fun fetchUpstream(@Path("model") model: String): PricingResponseDto
  @POST("api/pricing/fetch-upstream-all") suspend fun fetchAllUpstream(): BatchPricingResponseDto
}
