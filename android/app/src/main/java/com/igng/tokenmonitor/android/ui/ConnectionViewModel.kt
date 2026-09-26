package com.igng.tokenmonitor.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.igng.tokenmonitor.android.data.local.ConnectionConfig
import com.igng.tokenmonitor.android.data.model.HealthDto
import com.igng.tokenmonitor.android.data.repository.HubRepository
import com.igng.tokenmonitor.android.data.repository.HubResult
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class ConnectionUiState(
  val hubUrl: String = "",
  val secret: String = "",
  val allowInsecureHttp: Boolean = false,
  val loading: Boolean = true,
  val testing: Boolean = false,
  val message: String? = null,
  val health: HealthDto? = null
)

@HiltViewModel
class ConnectionViewModel @Inject constructor(private val repository: HubRepository) : ViewModel() {
  private val _state = MutableStateFlow(ConnectionUiState())
  val state = _state.asStateFlow()

  init {
    viewModelScope.launch {
      try {
        val saved = withContext(Dispatchers.IO) { repository.connection() }
        _state.value = ConnectionUiState(saved.hubUrl, saved.secret, saved.allowInsecureHttp, loading = false)
      } catch (error: CancellationException) {
        throw error
      } catch (_: Exception) {
        _state.value = ConnectionUiState(loading = false, message = "无法读取本机连接设置，请重新保存连接信息。")
      }
    }
  }

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

  fun save(onSaved: () -> Unit = {}) = viewModelScope.launch {
    val config = ConnectionConfig(_state.value.hubUrl, _state.value.secret, _state.value.allowInsecureHttp)
    try {
      withContext(Dispatchers.IO) { repository.saveConnection(config) }
      _state.value = _state.value.copy(message = "连接信息已加密保存。")
    } catch (error: CancellationException) {
      throw error
    } catch (_: Exception) {
      _state.value = _state.value.copy(message = "保存连接信息失败，请重试。")
      return@launch
    }
    onSaved()
  }

  fun clear(onCleared: () -> Unit = {}) = viewModelScope.launch {
    try {
      withContext(Dispatchers.IO) { repository.clearConnection() }
      _state.value = ConnectionUiState(loading = false, message = "已清除本机保存的连接信息。")
    } catch (error: CancellationException) {
      throw error
    } catch (_: Exception) {
      _state.value = _state.value.copy(message = "清除连接信息失败，请重试。")
      return@launch
    }
    onCleared()
  }
}
