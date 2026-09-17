package com.roxstar.voice

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.roxstar.voice.audio.NativeRecorder
import com.roxstar.voice.ui.HomeFragment
import com.roxstar.voice.ui.NameSetupFragment

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
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

    override fun onDestroy() {
        if (isFinishing && NativeRecorder.isRecording()) {
            NativeRecorder.cancel()
        }
        super.onDestroy()
    }
}
