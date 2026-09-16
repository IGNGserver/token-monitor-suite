package com.igng.tokenmonitor.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.igng.tokenmonitor.android.data.local.ConnectionConfig
import com.igng.tokenmonitor.android.data.model.HealthDto
import com.igng.tokenmonitor.android.data.repository.HubRepository
import com.igng.tokenmonitor.android.data.repository.HubResult
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ConnectionUiState(
  val hubUrl: String = "",
  val secret: String = "",
  val allowInsecureHttp: Boolean = false,
  val testing: Boolean = false,
  val message: String? = null,
  val health: HealthDto? = null
)

@HiltViewModel
class ConnectionViewModel @Inject constructor(private val repository: HubRepository) : ViewModel() {
  private val saved = repository.connection()
  private val _state = MutableStateFlow(
    ConnectionUiState(saved.hubUrl, saved.secret, saved.allowInsecureHttp)
  )
  val state = _state.asStateFlow()

  fun updateUrl(value: String) { _state.value = _state.value.copy(hubUrl = value) }
  fun updateSecret(value: String) { _state.value = _state.value.copy(secret = value) }
  fun updateAllowInsecureHttp(value: Boolean) { _state.value = _state.value.copy(allowInsecureHttp = value) }

  fun testConnection() = viewModelScope.launch {
    val config = ConnectionConfig(_state.value.hubUrl, _state.value.secret, _state.value.allowInsecureHttp)
    _state.value = _state.value.copy(testing = true, message = null)
    when (val result = repository.testConnection(config)) {
      is HubResult.Success -> _state.value = _state.value.copy(testing = false, health = result.value, message = "连接成功：Hub v${result.value.version ?: "?"}")
      is HubResult.Failure -> _state.value = _state.value.copy(testing = false, message = result.error.message)
    }
  }

  fun save() {
    repository.saveConnection(ConnectionConfig(_state.value.hubUrl, _state.value.secret, _state.value.allowInsecureHttp))
    _state.value = _state.value.copy(message = "连接信息已加密保存。")
  }

  fun clear() {
    repository.clearConnection()
    _state.value = ConnectionUiState(message = "已清除本机保存的连接信息。")
  }
}
