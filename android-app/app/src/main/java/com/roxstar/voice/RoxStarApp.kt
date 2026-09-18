package com.roxstar.voice

import android.app.Application
import com.roxstar.voice.data.DraftRepository
import com.roxstar.voice.data.SessionStore
import com.roxstar.voice.data.local.AppDatabase
import com.roxstar.voice.data.remote.ApiClient
import com.roxstar.voice.data.remote.SocketManager

class RoxStarApp : Application() {
    lateinit var session: SessionStore
        private set
    lateinit var db: AppDatabase
        private set
    lateinit var api: ApiClient
        private set
    lateinit var sockets: SocketManager
        private set
    lateinit var drafts: DraftRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        session = SessionStore(this)
        session.pinCloudUrl()
        db = AppDatabase.create(this)
        api = ApiClient(session.apiBaseUrl)
        sockets = SocketManager(api.gson) { api.baseUrl }
        drafts = DraftRepository(this, db, api)
    }

    fun applyApiBaseUrl(url: String) {
        session.apiBaseUrl = url
        api.rebuild(session.apiBaseUrl)
        sockets.rebuild()
    }

    companion object {
        lateinit var instance: RoxStarApp
            private set
    }
}
