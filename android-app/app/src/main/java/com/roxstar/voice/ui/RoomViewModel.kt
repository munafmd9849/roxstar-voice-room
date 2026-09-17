package com.roxstar.voice.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.roxstar.voice.RoxStarApp
import com.roxstar.voice.data.local.DraftEntity
import com.roxstar.voice.data.remote.ApiException
import com.roxstar.voice.data.remote.ConnectionStatus
import com.roxstar.voice.data.remote.RoomRealtimeEvent
import com.roxstar.voice.data.remote.RoomStateDto
import com.roxstar.voice.data.remote.ShareDraftRequest
import com.roxstar.voice.data.remote.UserIdRequest
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch

class RoomViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as RoxStarApp

    val connection: StateFlow<ConnectionStatus> = app.sockets.connection
    val roomState: StateFlow<RoomStateDto?> = app.sockets.roomState

    private val _log = MutableStateFlow<List<String>>(emptyList())
    val log: StateFlow<List<String>> = _log

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy

    private val _inRoom = MutableStateFlow(!app.session.currentRoomId.isNullOrBlank())
    val inRoom: StateFlow<Boolean> = _inRoom

    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 16)
    val messages: SharedFlow<String> = _messages.asSharedFlow()

    val currentUserId: String? get() = app.session.userId
    val isOwner: Boolean
        get() = roomState.value?.room?.ownerId == currentUserId

    init {
        viewModelScope.launch {
            app.sockets.events.collect { event ->
                when (event) {
                    is RoomRealtimeEvent.UserJoined -> append("${event.name} joined the room")
                    is RoomRealtimeEvent.UserLeft -> append(nameFor(event.userId)?.let { "$it left the room" } ?: "A participant left")
                    is RoomRealtimeEvent.DraftShared -> {
                        val owner = event.payload.sharedBy?.name ?: "Someone"
                        val title = event.payload.draft?.name ?: "a draft"
                        append("$owner shared \"$title\"")
                        _messages.tryEmit("Draft shared")
                    }
                    is RoomRealtimeEvent.SpinStarted -> append("Spin started")
                    is RoomRealtimeEvent.UserEliminated -> append("${displayName(event.userId)} eliminated")
                    is RoomRealtimeEvent.WinnerAnnounced -> append("Winner: ${displayName(event.userId)}")
                    is RoomRealtimeEvent.Error -> _messages.tryEmit(event.message)
                }
            }
        }
    }

    fun createRoom() {
        val userId = currentUserId ?: return emit("Create a user first.")
        launchBusy {
            val state = app.api.call { createRoom(UserIdRequest(userId)) }
            enterRoom(state)
        }
    }

    fun joinRoom(code: String) {
        val userId = currentUserId ?: return emit("Create a user first.")
        val normalized = code.trim().uppercase()
        if (normalized.length != 6) {
            emit("Room code must be 6 characters.")
            return
        }
        launchBusy {
            val state = app.api.call { joinRoom(normalized, UserIdRequest(userId)) }
            enterRoom(state)
        }
    }

    fun refreshRoom() {
        val roomId = app.session.currentRoomId ?: return
        launchBusy {
            val state = app.api.call { getRoom(roomId) }
            applyState(state)
            app.sockets.requestRoomState()
        }
    }

    fun leaveRoom() {
        val userId = currentUserId ?: return
        val roomId = app.session.currentRoomId ?: return
        launchBusy {
            runCatching { app.sockets.leavePresence() }
            app.api.call { leaveRoom(roomId, UserIdRequest(userId)) }
            app.session.clearRoom()
            _inRoom.value = false
            _log.value = emptyList()
            append("Left room.")
        }
    }

    fun shareDraft(draft: DraftEntity) {
        val userId = currentUserId ?: return emit("Create a user first.")
        val roomId = app.session.currentRoomId ?: return emit("Join a room first.")
        launchBusy {
            val synced = app.drafts.ensureBackendId(draft, userId)
            val remoteId = synced.backendId ?: return@launchBusy emit("Draft is not available on the backend yet.")
            val result = app.api.call { shareDraft(roomId, ShareDraftRequest(userId, remoteId)) }
            emit(if (result.duplicate) "Draft was already shared." else "Draft shared")
        }
    }

    fun startSpin() {
        val userId = currentUserId ?: return emit("Create a user first.")
        val roomId = app.session.currentRoomId ?: return emit("Join a room first.")
        launchBusy {
            app.api.call { startSpin(roomId, UserIdRequest(userId)) }
            append("Requested spin start.")
        }
    }

    fun disconnectSocket() {
        app.sockets.disconnectForDemo()
        append("Socket disconnected (membership kept).")
    }

    fun reconnectSocket() {
        val roomId = app.session.currentRoomId
        val userId = currentUserId
        if (roomId == null || userId == null) {
            emit("Join a room first.")
            return
        }
        app.sockets.reconnectForDemo()
        append("Reconnecting socket and requesting room_state.")
    }

    fun restoreIfNeeded() {
        val roomId = app.session.currentRoomId ?: return
        val userId = currentUserId ?: return
        app.sockets.connectAndJoin(roomId, userId)
        refreshRoom()
    }

    private fun enterRoom(state: RoomStateDto) {
        applyState(state)
        currentUserId?.let { app.sockets.connectAndJoin(state.room.id, it) }
        append("In room ${state.room.code}")
    }

    private fun applyState(state: RoomStateDto) {
        app.session.currentRoomId = state.room.id
        app.session.currentRoomCode = state.room.code
        _inRoom.value = true
    }

    private fun launchBusy(block: suspend () -> Unit) {
        viewModelScope.launch {
            if (_busy.value) return@launch
            _busy.value = true
            try {
                block()
            } catch (error: ApiException) {
                emit(error.message)
            } catch (error: Exception) {
                emit(error.message ?: "Unexpected error.")
            } finally {
                _busy.value = false
            }
        }
    }

    private fun emit(message: String) {
        _messages.tryEmit(message)
    }

    private fun append(line: String) {
        _log.value = (_log.value + line).takeLast(40)
    }

    private fun nameFor(userId: String): String? {
        return roomState.value?.participants?.firstOrNull { it.userId == userId }?.name
            ?: roomState.value?.spin?.participants?.firstOrNull { it.userId == userId }?.name
    }

    private fun displayName(userId: String): String = nameFor(userId) ?: userId
}
