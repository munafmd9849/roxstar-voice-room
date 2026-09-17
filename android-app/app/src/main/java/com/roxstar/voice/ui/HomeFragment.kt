package com.roxstar.voice.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.roxstar.voice.MainActivity
import com.roxstar.voice.RoxStarApp
import com.roxstar.voice.databinding.FragmentHomeBinding

class HomeFragment : Fragment() {
    private var binding: FragmentHomeBinding? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val view = FragmentHomeBinding.inflate(inflater, container, false)
        binding = view
        val app = RoxStarApp.instance
        view.welcome.text = "Hello, ${app.session.userName ?: "there"}"
        view.userId.text = "User ID: ${app.session.userId}"
        view.apiUrl.setText(app.session.apiBaseUrl)
        view.saveUrl.setOnClickListener {
            app.applyApiBaseUrl(view.apiUrl.text?.toString().orEmpty())
            view.apiUrl.setText(app.session.apiBaseUrl)
            Toast.makeText(requireContext(), "API URL saved: ${app.session.apiBaseUrl}", Toast.LENGTH_SHORT).show()
        }
        val activity = activity as MainActivity
        view.openRecorder.setOnClickListener { activity.open(RecorderFragment()) }
        view.openDrafts.setOnClickListener { activity.open(DraftsFragment()) }
        view.openRoom.setOnClickListener { activity.open(RoomFragment()) }
        return view.root
    }

    override fun onResume() {
        super.onResume()
        val roomCode = RoxStarApp.instance.session.currentRoomCode
        binding?.roomHint?.text = if (roomCode.isNullOrBlank()) {
            "Not in a room"
        } else {
            "Currently in room $roomCode"
        }
    }

    override fun onDestroyView() {
        binding = null
        super.onDestroyView()
    }
}
