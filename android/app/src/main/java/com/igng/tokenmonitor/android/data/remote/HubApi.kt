package com.igng.tokenmonitor.android.data.remote

import com.igng.tokenmonitor.android.data.model.AccountRequestDto
import com.igng.tokenmonitor.android.data.model.AccountsResponseDto
import com.igng.tokenmonitor.android.data.model.BatchPricingResponseDto
import com.igng.tokenmonitor.android.data.model.OAuthExchangeRequestDto
import com.igng.tokenmonitor.android.data.model.OAuthStartDto
import com.igng.tokenmonitor.android.data.model.RatesResponseDto
import com.igng.tokenmonitor.android.data.model.SubscriptionsRequestDto
import com.igng.tokenmonitor.android.data.model.SubscriptionsResponseDto
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
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface HubApi {
  @GET("api/health") suspend fun health(): HealthDto
  @GET("api/capabilities") suspend fun capabilities(): HubAuthorizationDto
  @GET("api/stats") suspend fun stats(): StatsDto
  // [deviceId] scopes the daily/monthly history to one machine.  Without the parameter
  // every trend the client drew was the whole fleet aggregated, which is why the
  // device detail could not show a device's own history.
  @GET("api/history") suspend fun history(@Query("deviceId") deviceId: String? = null): HistoryDto
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

  @GET("api/rates") suspend fun rates(): RatesResponseDto

  @GET("api/accounts") suspend fun accounts(): AccountsResponseDto
  @POST("api/accounts") suspend fun addAccount(@Body request: AccountRequestDto): AccountsResponseDto
  @PATCH("api/accounts/{id}") suspend fun patchAccount(
    @Path("id") id: String,
    @Body request: AccountRequestDto
  ): AccountsResponseDto
  @DELETE("api/accounts/{id}") suspend fun deleteAccount(@Path("id") id: String): AccountsResponseDto
  @POST("api/accounts/{id}/refresh") suspend fun refreshAccount(@Path("id") id: String): AccountsResponseDto
  @POST("api/accounts/oauth/start") suspend fun startOAuth(@Body body: Map<String, String>): OAuthStartDto
  @POST("api/accounts/oauth/exchange") suspend fun exchangeOAuth(
    @Body request: OAuthExchangeRequestDto
  ): AccountsResponseDto

  @GET("api/subscriptions") suspend fun subscriptions(): SubscriptionsResponseDto
  @PUT("api/subscriptions") suspend fun putSubscriptions(
    @Body request: SubscriptionsRequestDto
  ): SubscriptionsResponseDto

  @POST("api/devices/{id}/rename") suspend fun renameDevice(
    @Path("id") id: String,
    @Body body: Map<String, String>
  ): DevicesResponseDto
  @DELETE("api/devices/{id}") suspend fun deleteDevice(@Path("id") id: String): DevicesResponseDto
}
