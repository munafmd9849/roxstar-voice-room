package com.roxstar.voice.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import com.google.android.material.appbar.MaterialToolbar
import com.roxstar.voice.MainActivity
import com.roxstar.voice.R
import com.roxstar.voice.RoxStarApp
import com.roxstar.voice.databinding.FragmentHomeBinding

class HomeFragment : Fragment() {
    private var binding: FragmentHomeBinding? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val view = FragmentHomeBinding.inflate(inflater, container, false)
        binding = view
        val app = RoxStarApp.instance
        view.welcome.text = "Hello, ${app.session.userName ?: "there"}"
        val activity = activity as MainActivity
        view.openRecorder.setOnClickListener { activity.open(RecorderFragment()) }
        view.openDrafts.setOnClickListener { activity.open(DraftsFragment()) }
        view.openRoom.setOnClickListener { activity.open(RoomFragment()) }
        return view.root
    }

    override fun onResume() {
        super.onResume()
        val host = activity as MainActivity
        host.supportActionBar?.title = "RoxStar Voice"
        val toolbar = host.findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.menu.clear()
        toolbar.inflateMenu(R.menu.menu_home)
        toolbar.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                R.id.action_settings -> {
                    host.open(SettingsFragment())
                    true
                }
                R.id.action_logout -> {
                    host.logout()
                    true
                }
                else -> false
            }
        }
        val roomCode = RoxStarApp.instance.session.currentRoomCode
        binding?.roomHint?.text = if (roomCode.isNullOrBlank()) {
            "Not in a room"
        } else {
            "Currently in room $roomCode"
        }
    }

    override fun onPause() {
        (activity as? MainActivity)?.findViewById<MaterialToolbar>(R.id.toolbar)?.apply {
            menu.clear()
            setOnMenuItemClickListener(null)
        }
        super.onPause()
    }

    override fun onDestroyView() {
        binding = null
        super.onDestroyView()
    }
}
