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
        get() {
            val stored = prefs.getString(KEY_API_URL, null)?.trim().orEmpty()
            if (stored.isBlank() || isLegacyLocalUrl(stored)) {
                return BuildConfig.API_BASE_URL
            }
            return stored
        }
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

    fun clearUser() {
        prefs.edit()
            .remove(KEY_USER_ID)
            .remove(KEY_USER_NAME)
            .remove(KEY_ROOM_ID)
            .remove(KEY_ROOM_CODE)
            .apply()
    }

    fun pinCloudUrl() {
        if (isLegacyLocalUrl(prefs.getString(KEY_API_URL, "") ?: "")) {
            prefs.edit().remove(KEY_API_URL).apply()
        }
        apiBaseUrl = BuildConfig.API_BASE_URL
    }

    private fun isLegacyLocalUrl(url: String): Boolean {
        val value = url.lowercase()
        return value.contains("10.0.2.2") ||
            value.contains("10.7.9.169") ||
            value.contains("127.0.0.1") ||
            value.contains("localhost")
    }

    companion object {
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_API_URL = "api_base_url"
        private const val KEY_ROOM_ID = "room_id"
        private const val KEY_ROOM_CODE = "room_code"
    }
}
