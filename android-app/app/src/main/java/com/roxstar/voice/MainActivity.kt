package com.roxstar.voice

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.roxstar.voice.audio.NativeRecorder
import com.roxstar.voice.data.remote.UserIdRequest
import com.roxstar.voice.ui.HomeFragment
import com.roxstar.voice.ui.NameSetupFragment
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        setSupportActionBar(findViewById(R.id.toolbar))
        supportFragmentManager.addOnBackStackChangedListener {
            supportActionBar?.setDisplayHomeAsUpEnabled(supportFragmentManager.backStackEntryCount > 0)
        }
        if (savedInstanceState == null) {
            val start = if (RoxStarApp.instance.session.hasUser) {
                HomeFragment()
            } else {
                NameSetupFragment()
            }
            supportFragmentManager.beginTransaction()
                .replace(R.id.container, start)
                .commit()
        }
    }

    fun open(fragment: Fragment, addToBackStack: Boolean = true) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.container, fragment)
            .apply { if (addToBackStack) addToBackStack(fragment::class.java.simpleName) }
            .commit()
    }

    fun goHome() {
        supportFragmentManager.popBackStack(null, androidx.fragment.app.FragmentManager.POP_BACK_STACK_INCLUSIVE)
        supportFragmentManager.beginTransaction()
            .replace(R.id.container, HomeFragment())
            .commit()
    }

    fun logout() {
        lifecycleScope.launch {
            val app = RoxStarApp.instance
            val roomId = app.session.currentRoomId
            val userId = app.session.userId
            runCatching { app.sockets.shutdown() }
            if (roomId != null && userId != null) {
                runCatching { app.api.call { leaveRoom(roomId, UserIdRequest(userId)) } }
            }
            app.session.clearUser()
            viewModelStore.clear()
            supportFragmentManager.popBackStack(null, androidx.fragment.app.FragmentManager.POP_BACK_STACK_INCLUSIVE)
            supportFragmentManager.beginTransaction()
                .replace(R.id.container, NameSetupFragment())
                .commit()
        }
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }

    override fun onDestroy() {
        runCatching {
            if (isFinishing && NativeRecorder.isRecording()) {
                NativeRecorder.cancel()
            }
        }
        super.onDestroy()
    }
}
