package com.igng.tokenmonitor.android.data.repository

import com.igng.tokenmonitor.android.data.local.ConnectionConfig
import com.igng.tokenmonitor.android.data.local.ConnectionStorage
import com.igng.tokenmonitor.android.data.remote.HubApiFactory
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class HubRepositoryTest {
  private lateinit var server: MockWebServer
  private lateinit var repository: HubRepository
  private lateinit var store: FakeConnectionStorage
  private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

  @Before fun setUp() {
    server = MockWebServer()
    server.start()
    store = FakeConnectionStorage(ConnectionConfig(server.url("/").toString(), "shared-secret"))
    repository = HubRepository(store, HubApiFactory.forTesting(json, 150), json)
  }

  @After fun tearDown() { server.shutdown() }

  @Test fun pricingReturnsDataFor200() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(200).setBody("""{"pricing":[{"model":"gpt-5","inputPricePerMillion":1.25,"outputPricePerMillion":10,"cacheReadPricePerMillion":0.125,"cacheWritePricePerMillion":0,"source":"manual"}]}"""))

    val result = repository.pricing()

    assertTrue(result is HubResult.Success)
    assertEquals("gpt-5", (result as HubResult.Success).value.pricing.single().model)
    assertEquals("Bearer shared-secret", server.takeRequest().getHeader("Authorization"))
  }

  @Test fun testConnectionVerifiesHealthAndAuthenticatedStats() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(200).setBody("""{"ok":true,"role":"hub","version":1}"""))
    server.enqueue(MockResponse().setResponseCode(200).setBody("""{"periods":{}}"""))
    server.enqueue(MockResponse().setResponseCode(200).setBody("""{"apiVersion":2,"capabilities":{"stats":true,"usageRange":false,"pricing":false},"role":"device","scopes":["read","ingest"]}"""))

    val result = repository.testConnection(store.read())

    assertTrue(result is HubResult.Success)
    assertEquals("hub", (result as HubResult.Success).value.role)
    assertEquals("device", result.value.authenticatedRole)
    assertEquals(listOf("read", "ingest"), result.value.grantedScopes)
    assertEquals("Bearer shared-secret", server.takeRequest().getHeader("Authorization"))
    assertEquals("Bearer shared-secret", server.takeRequest().getHeader("Authorization"))
    assertEquals("Bearer shared-secret", server.takeRequest().getHeader("Authorization"))
  }

  @Test fun testConnectionRejectsASecretThatCannotReadStats() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(200).setBody("""{"ok":true,"role":"hub"}"""))
    server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"unauthorized"}"""))

    val result = repository.testConnection(store.read())

    assertTrue(result is HubResult.Failure)
    assertEquals(HubError.Kind.Unauthorized, (result as HubResult.Failure).error.kind)
  }

  @Test fun pricingMaps401ToReadableUnauthorizedError() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"unauthorized"}"""))

    val result = repository.pricing()

    assertTrue(result is HubResult.Failure)
    assertEquals(HubError.Kind.Unauthorized, (result as HubResult.Failure).error.kind)
  }

  @Test fun pricingMapsTimeoutToNetworkError() = runBlocking {
    server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))

    val result = repository.pricing()

    assertTrue(result is HubResult.Failure)
    assertEquals(HubError.Kind.Network, (result as HubResult.Failure).error.kind)
  }

  @Test fun pricingMapsMalformedJsonToReadableError() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(200).setBody("{not-json"))

    val result = repository.pricing()

    assertTrue(result is HubResult.Failure)
    assertEquals(HubError.Kind.MalformedResponse, (result as HubResult.Failure).error.kind)
  }

  @Test fun upstream422KeepsHubFailureReason() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(422).setBody("""{"error":"pricing_not_found","message":"No upstream pricing was found for missing-model"}"""))

    val result = repository.fetchUpstream("missing-model")

    assertTrue(result is HubResult.Failure)
    val error = (result as HubResult.Failure).error
    assertEquals(HubError.Kind.Api, error.kind)
    assertTrue(error.message.contains("pricing_not_found"))
  }

  private class FakeConnectionStorage(private var config: ConnectionConfig) : ConnectionStorage {
    override fun read(): ConnectionConfig = config
    override fun save(config: ConnectionConfig) { this.config = config }
    override fun clear() { config = ConnectionConfig("", "") }
  }
}
