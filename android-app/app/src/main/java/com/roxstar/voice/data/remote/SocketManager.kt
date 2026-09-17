package com.roxstar.voice.data.remote

import android.os.Handler
import android.os.Looper
import com.google.gson.Gson
import io.socket.client.IO
import io.socket.client.Manager
import io.socket.client.Socket
import io.socket.engineio.client.transports.Polling
import io.socket.engineio.client.transports.WebSocket
import java.net.URI
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject

enum class ConnectionStatus {
    CONNECTED,
    DISCONNECTED,
    RECONNECTING
}

sealed class RoomRealtimeEvent {
    data class UserJoined(val userId: String, val name: String) : RoomRealtimeEvent()
    data class UserLeft(val userId: String) : RoomRealtimeEvent()
    data class DraftShared(val payload: ShareDraftResponse) : RoomRealtimeEvent()
    data class SpinStarted(val spin: SpinDto?) : RoomRealtimeEvent()
    data class UserEliminated(val userId: String) : RoomRealtimeEvent()
    data class WinnerAnnounced(val userId: String) : RoomRealtimeEvent()
    data class Error(val message: String) : RoomRealtimeEvent()
}

class SocketManager(
    private val gson: Gson,
    private val baseUrlProvider: () -> String
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var socket: Socket? = null
    private var joinedRoomId: String? = null
    private var joinedUserId: String? = null

    private val _connection = MutableStateFlow(ConnectionStatus.DISCONNECTED)
    val connection: StateFlow<ConnectionStatus> = _connection

    private val _roomState = MutableStateFlow<RoomStateDto?>(null)
    val roomState: StateFlow<RoomStateDto?> = _roomState

    private val _events = MutableSharedFlow<RoomRealtimeEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<RoomRealtimeEvent> = _events

    @Synchronized
    fun connectAndJoin(roomId: String, userId: String) {
        joinedRoomId = roomId
        joinedUserId = userId
        ensureSocket()
        val current = socket ?: return
        if (current.connected()) {
            joinCurrentRoom()
        } else {
            _connection.value = ConnectionStatus.RECONNECTING
            current.connect()
        }
    }

    @Synchronized
    fun requestRoomState() {
        val roomId = joinedRoomId ?: return
        socket?.emit("room:state", JSONObject().put("roomId", roomId))
    }

    @Synchronized
    fun disconnectForDemo() {
        socket?.disconnect()
        _connection.value = ConnectionStatus.DISCONNECTED
    }

    @Synchronized
    fun reconnectForDemo() {
        val roomId = joinedRoomId
        val userId = joinedUserId
        if (roomId == null || userId == null) {
            return
        }
        _connection.value = ConnectionStatus.RECONNECTING
        ensureSocket()
        socket?.connect()
    }

    @Synchronized
    fun leavePresence() {
        val roomId = joinedRoomId
        if (roomId != null) {
            socket?.emit("room:leave", JSONObject().put("roomId", roomId))
        }
        joinedRoomId = null
        joinedUserId = null
        _roomState.value = null
    }

    @Synchronized
    fun shutdown() {
        leavePresence()
        socket?.off()
        socket?.io()?.off()
        socket?.disconnect()
        socket = null
        _connection.value = ConnectionStatus.DISCONNECTED
    }

    @Synchronized
    fun rebuild() {
        shutdown()
    }

    private fun ensureSocket() {
        if (socket != null) {
            return
        }
        val options = IO.Options.builder()
            .setForceNew(true)
            .setReconnection(true)
            .setReconnectionAttempts(Int.MAX_VALUE)
            .setReconnectionDelay(1_000)
            .setReconnectionDelayMax(5_000)
            .setTransports(arrayOf(WebSocket.NAME, Polling.NAME))
            .build()
        val created = IO.socket(URI.create(baseUrlProvider()), options)
        attach(created)
        socket = created
    }

    private fun attach(target: Socket) {
        target.on(Socket.EVENT_CONNECT) {
            post {
                _connection.value = ConnectionStatus.CONNECTED
                joinCurrentRoom()
            }
        }
        target.on(Socket.EVENT_DISCONNECT) {
            post { _connection.value = ConnectionStatus.DISCONNECTED }
        }
        target.on(Socket.EVENT_CONNECT_ERROR) { args ->
            post {
                _connection.value = ConnectionStatus.RECONNECTING
                _events.tryEmit(RoomRealtimeEvent.Error(args.firstOrNull()?.toString() ?: "Socket connection failed."))
            }
        }
        target.io().on(Manager.EVENT_RECONNECT_ATTEMPT) {
            post { _connection.value = ConnectionStatus.RECONNECTING }
        }
        target.on("room_state") { args ->
            val state = parse(args, RoomStateDto::class.java) ?: return@on
            post { _roomState.value = state }
        }
        target.on("user_joined") { args ->
            val json = jsonArg(args)
            post {
                _events.tryEmit(
                    RoomRealtimeEvent.UserJoined(
                        json.optString("userId"),
                        json.optString("name")
                    )
                )
            }
        }
        target.on("user_left") { args ->
            val json = jsonArg(args)
            post { _events.tryEmit(RoomRealtimeEvent.UserLeft(json.optString("userId"))) }
        }
        target.on("draft_shared") { args ->
            val payload = parse(args, ShareDraftResponse::class.java) ?: return@on
            post { _events.tryEmit(RoomRealtimeEvent.DraftShared(payload)) }
        }
        target.on("spin_started") { args ->
            val json = jsonArg(args)
            val spin = runCatching {
                gson.fromJson(json.optJSONObject("spin")?.toString(), SpinDto::class.java)
            }.getOrNull()
            post { _events.tryEmit(RoomRealtimeEvent.SpinStarted(spin)) }
        }
        target.on("user_eliminated") { args ->
            val json = jsonArg(args)
            post { _events.tryEmit(RoomRealtimeEvent.UserEliminated(json.optString("userId"))) }
        }
        target.on("winner_announced") { args ->
            val json = jsonArg(args)
            post { _events.tryEmit(RoomRealtimeEvent.WinnerAnnounced(json.optString("userId"))) }
        }
        target.on("socket:error") { args ->
            val json = jsonArg(args)
            val message = json.optString("message").ifBlank { json.toString() }
            post { _events.tryEmit(RoomRealtimeEvent.Error(message)) }
        }
    }

    private fun joinCurrentRoom() {
        val roomId = joinedRoomId ?: return
        val userId = joinedUserId ?: return
        socket?.emit("room:join", JSONObject().put("roomId", roomId).put("userId", userId))
        socket?.emit("room:state", JSONObject().put("roomId", roomId))
    }

    private fun jsonArg(args: Array<Any>): JSONObject {
        return when (val first = args.firstOrNull()) {
            is JSONObject -> first
            is String -> runCatching { JSONObject(first) }.getOrElse { JSONObject() }
            else -> JSONObject()
        }
    }

    private fun <T> parse(args: Array<Any>, type: Class<T>): T? {
        return runCatching { gson.fromJson(jsonArg(args).toString(), type) }.getOrNull()
    }

    private fun post(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            block()
        } else {
            mainHandler.post(block)
        }
    }
}
