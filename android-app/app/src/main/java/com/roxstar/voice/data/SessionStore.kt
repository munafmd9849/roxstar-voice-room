package com.roxstar.voice.data

import android.content.Context
import com.roxstar.voice.BuildConfig

class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("roxstar_session", Context.MODE_PRIVATE)

    var userId: String?
        get() = prefs.getString(KEY_USER_ID, null)
        set(value) {
            prefs.edit().putString(KEY_USER_ID, value).apply()
        }

    var userName: String?
        get() = prefs.getString(KEY_USER_NAME, null)
        set(value) {
            prefs.edit().putString(KEY_USER_NAME, value).apply()
        }

    var apiBaseUrl: String
        get() = prefs.getString(KEY_API_URL, BuildConfig.API_BASE_URL)?.trim().orEmpty().ifBlank { BuildConfig.API_BASE_URL }
        set(value) {
            val normalized = value.trim().trimEnd('/')
            prefs.edit().putString(KEY_API_URL, normalized.ifBlank { BuildConfig.API_BASE_URL }).apply()
        }

    var currentRoomId: String?
        get() = prefs.getString(KEY_ROOM_ID, null)
        set(value) {
            prefs.edit().putString(KEY_ROOM_ID, value).apply()
        }

    var currentRoomCode: String?
        get() = prefs.getString(KEY_ROOM_CODE, null)
        set(value) {
            prefs.edit().putString(KEY_ROOM_CODE, value).apply()
        }

    val hasUser: Boolean
        get() = !userId.isNullOrBlank()

    fun clearRoom() {
        prefs.edit().remove(KEY_ROOM_ID).remove(KEY_ROOM_CODE).apply()
    }

    companion object {
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_API_URL = "api_base_url"
        private const val KEY_ROOM_ID = "room_id"
        private const val KEY_ROOM_CODE = "room_code"
    }
}
