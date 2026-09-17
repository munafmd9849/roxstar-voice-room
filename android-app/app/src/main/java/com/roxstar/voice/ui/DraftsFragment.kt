package com.roxstar.voice.ui

import android.media.MediaPlayer
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.roxstar.voice.RoxStarApp
import com.roxstar.voice.data.local.DraftEntity
import com.roxstar.voice.databinding.FragmentDraftsBinding
import java.io.File
import kotlinx.coroutines.launch

class DraftsFragment : Fragment() {
    private var binding: FragmentDraftsBinding? = null
    private var player: MediaPlayer? = null
    private val adapter = DraftAdapter(
        onPlay = { play(it) },
        onDelete = { delete(it) }
    )

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val view = FragmentDraftsBinding.inflate(inflater, container, false)
        binding = view
        view.list.layoutManager = LinearLayoutManager(requireContext())
        view.list.adapter = adapter
        viewLifecycleOwner.lifecycleScope.launch {
            RoxStarApp.instance.drafts.observe().collect { drafts ->
                adapter.submit(drafts)
                view.empty.visibility = if (drafts.isEmpty()) View.VISIBLE else View.GONE
            }
        }
        return view.root
    }

    override fun onResume() {
        super.onResume()
        (activity as? androidx.appcompat.app.AppCompatActivity)?.supportActionBar?.title = "Drafts"
    }

    private fun play(draft: DraftEntity) {
        val file = File(draft.filePath)
        if (!file.exists()) {
            Toast.makeText(requireContext(), "Audio file is missing.", Toast.LENGTH_SHORT).show()
            return
        }
        stopPlayback()
        try {
            player = MediaPlayer().apply {
                setDataSource(file.absolutePath)
                setOnCompletionListener { stopPlayback() }
                prepare()
                start()
            }
            Toast.makeText(requireContext(), "Playing ${draft.name}", Toast.LENGTH_SHORT).show()
        } catch (error: Exception) {
            stopPlayback()
            Toast.makeText(requireContext(), error.message ?: "Playback failed.", Toast.LENGTH_LONG).show()
        }
    }

    private fun delete(draft: DraftEntity) {
        viewLifecycleOwner.lifecycleScope.launch {
            stopPlayback()
            RoxStarApp.instance.drafts.delete(draft)
            Toast.makeText(requireContext(), "Deleted ${draft.name}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun stopPlayback() {
        runCatching {
            player?.stop()
            player?.release()
        }
        player = null
    }

    override fun onDestroyView() {
        stopPlayback()
        binding = null
        super.onDestroyView()
    }
}
