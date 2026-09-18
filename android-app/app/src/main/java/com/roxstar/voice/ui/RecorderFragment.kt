package com.roxstar.voice.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.roxstar.voice.RoxStarApp
import com.roxstar.voice.audio.NativeRecorder
import com.roxstar.voice.audio.RecordingState
import com.roxstar.voice.audio.label
import com.roxstar.voice.data.remote.ApiException
import com.roxstar.voice.databinding.FragmentRecorderBinding
import com.roxstar.voice.util.formatDuration
import java.io.File
import kotlinx.coroutines.launch

class RecorderFragment : Fragment() {
    private var binding: FragmentRecorderBinding? = null
    private val handler = Handler(Looper.getMainLooper())
    private var pendingStart = false
    private var lastEcho = false
    private var lastPath: String? = null

    private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            if (pendingStart) beginRecording()
        } else {
            pendingStart = false
            val permanentlyDenied = !shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO)
            val message = if (permanentlyDenied) {
                "Microphone permission is permanently denied. Enable it in system settings."
            } else {
                "Microphone permission is required to record."
            }
            binding?.status?.text = message
            Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show()
            if (permanentlyDenied) {
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", requireContext().packageName, null)))
            }
        }
        refreshButtons()
    }

    private val ticker = object : Runnable {
        override fun run() {
            val view = binding ?: return
            view.state.text = NativeRecorder.state().label()
            view.timer.text = formatDuration(NativeRecorder.durationMs())
            if (NativeRecorder.state() == RecordingState.RECORDING) {
                handler.postDelayed(this, 200)
            }
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val view = FragmentRecorderBinding.inflate(inflater, container, false)
        binding = view
        view.echoSwitch.setOnCheckedChangeListener { _, checked ->
            if (NativeRecorder.isRecording()) {
                NativeRecorder.setEchoEnabled(checked)
            }
        }
        view.start.setOnClickListener { requestAndStart() }
        view.stop.setOnClickListener { stopRecording() }
        view.cancel.setOnClickListener { cancelRecording() }
        view.saveDraft.setOnClickListener { saveDraft() }
        renderFromNative()
        return view.root
    }

    override fun onResume() {
        super.onResume()
        (activity as? androidx.appcompat.app.AppCompatActivity)?.supportActionBar?.title = "Recorder"
        renderFromNative()
        if (NativeRecorder.isRecording()) {
            handler.post(ticker)
        }
    }

    override fun onPause() {
        handler.removeCallbacks(ticker)
        super.onPause()
    }

    override fun onDestroyView() {
        handler.removeCallbacks(ticker)
        binding = null
        super.onDestroyView()
    }

    private fun requestAndStart() {
        val state = NativeRecorder.state()
        if (state == RecordingState.RECORDING || state == RecordingState.STOPPING) {
            return
        }
        pendingStart = true
        when {
            ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED -> beginRecording()
            shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO) -> {
                binding?.status?.text = "RoxStar needs the microphone to record a local draft."
                permission.launch(Manifest.permission.RECORD_AUDIO)
            }
            else -> permission.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    private fun beginRecording() {
        pendingStart = false
        val view = binding ?: return
        lastEcho = view.echoSwitch.isChecked
        val target = File(requireContext().filesDir, "recording-${System.currentTimeMillis()}.wav")
        val started = NativeRecorder.start(target.absolutePath, lastEcho)
        if (!started) {
            view.status.text = NativeRecorder.lastError() ?: "Could not start recording."
            view.state.text = NativeRecorder.state().label()
            refreshButtons()
            return
        }
        lastPath = null
        view.savePanel.visibility = View.GONE
        view.status.text = if (lastEcho) "Recording with echo" else "Recording"
        handler.removeCallbacks(ticker)
        handler.post(ticker)
        refreshButtons()
    }

    private fun stopRecording() {
        val view = binding ?: return
        if (NativeRecorder.state() != RecordingState.RECORDING) {
            return
        }
        view.state.text = RecordingState.STOPPING.label()
        val path = NativeRecorder.stop()
        handler.removeCallbacks(ticker)
        if (path == null) {
            view.status.text = NativeRecorder.lastError() ?: "Stop failed."
            view.state.text = NativeRecorder.state().label()
            refreshButtons()
            return
        }
        lastPath = path
        view.timer.text = formatDuration(NativeRecorder.durationMs())
        view.state.text = RecordingState.SAVED.label()
        view.status.text = "Saving draft..."
        view.draftName.setText("Draft ${System.currentTimeMillis() % 1000}")
        view.savePanel.visibility = View.VISIBLE
        refreshButtons()
        saveDraft()
    }

    private fun cancelRecording() {
        NativeRecorder.cancel()
        handler.removeCallbacks(ticker)
        lastPath = null
        val view = binding ?: return
        view.savePanel.visibility = View.GONE
        view.timer.text = "0:00"
        view.state.text = RecordingState.CANCELLED.label()
        view.status.text = "Recording discarded."
        refreshButtons()
    }

    private fun saveDraft() {
        val view = binding ?: return
        val path = lastPath
        val userId = RoxStarApp.instance.session.userId
        if (path == null) {
            Toast.makeText(requireContext(), "Record and stop before saving.", Toast.LENGTH_SHORT).show()
            return
        }
        if (userId == null) {
            Toast.makeText(requireContext(), "Create a user first.", Toast.LENGTH_SHORT).show()
            return
        }
        val name = view.draftName.text?.toString()?.trim().orEmpty()
        if (name.isEmpty()) {
            Toast.makeText(requireContext(), "Enter a draft name.", Toast.LENGTH_SHORT).show()
            return
        }
        val duration = NativeRecorder.durationMs().coerceAtLeast(1)
        val imm = requireContext().getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
        imm.hideSoftInputFromWindow(view.root.windowToken, 0)
        view.saveDraft.isEnabled = false
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val saved = RoxStarApp.instance.drafts.saveLocalAndRemote(
                    name = name,
                    wavPath = path,
                    durationMs = duration,
                    echoEnabled = lastEcho,
                    userId = userId
                )
                lastPath = saved.filePath
                val remoteNote = if (saved.backendId == null) " Local only; backend was unavailable." else " Synced metadata to backend."
                view.status.text = "Draft saved.${remoteNote}"
                view.savePanel.visibility = View.GONE
                Toast.makeText(requireContext(), "Draft saved", Toast.LENGTH_SHORT).show()
            } catch (error: ApiException) {
                view.status.text = error.message
            } catch (error: Exception) {
                view.status.text = error.message ?: "Could not save draft."
            } finally {
                view.saveDraft.isEnabled = true
            }
        }
    }

    private fun renderFromNative() {
        val view = binding ?: return
        val state = NativeRecorder.state()
        view.state.text = state.label()
        view.timer.text = formatDuration(NativeRecorder.durationMs())
        view.savePanel.visibility = if (state == RecordingState.SAVED && lastPath != null) View.VISIBLE else View.GONE
        refreshButtons()
    }

    private fun refreshButtons() {
        val view = binding ?: return
        val state = NativeRecorder.state()
        val recording = state == RecordingState.RECORDING
        val stopping = state == RecordingState.STOPPING
        view.start.isEnabled = !recording && !stopping
        view.stop.isEnabled = recording
        view.cancel.isEnabled = recording
        view.echoSwitch.isEnabled = true
    }
}
