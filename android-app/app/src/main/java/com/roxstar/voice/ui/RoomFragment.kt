package com.roxstar.voice.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import com.roxstar.voice.MainActivity
import com.roxstar.voice.RoxStarApp
import com.roxstar.voice.data.local.DraftEntity
import com.roxstar.voice.data.remote.ConnectionStatus
import com.roxstar.voice.data.remote.RoomStateDto
import com.roxstar.voice.databinding.FragmentRoomBinding
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

class RoomFragment : Fragment() {
    private var binding: FragmentRoomBinding? = null
    private val roomVm: RoomViewModel by activityViewModels()
    private var drafts: List<DraftEntity> = emptyList()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val view = FragmentRoomBinding.inflate(inflater, container, false)
        binding = view
        view.createRoom.setOnClickListener { roomVm.createRoom() }
        view.joinRoom.setOnClickListener { roomVm.joinRoom(view.roomCodeInput.text?.toString().orEmpty()) }
        view.leaveRoom.setOnClickListener { roomVm.leaveRoom() }
        view.refreshRoom.setOnClickListener { roomVm.refreshRoom() }
        view.shareDraft.setOnClickListener { shareSelected() }
        view.openSpin.setOnClickListener { (activity as MainActivity).open(SpinFragment()) }
        view.disconnectSocket.setOnClickListener { roomVm.disconnectSocket() }
        view.reconnectSocket.setOnClickListener { roomVm.reconnectSocket() }
        view.copyCode.setOnClickListener { copyRoomCode() }
        roomVm.restoreIfNeeded()
        viewLifecycleOwner.lifecycleScope.launch {
            combine(roomVm.inRoom, roomVm.roomState, roomVm.connection, roomVm.log, roomVm.busy) { inRoom, state, connection, log, busy ->
                RoomSnapshot(inRoom, state, connection, log, busy)
            }.combine(roomVm.sharedDrafts) { snapshot, shared ->
                snapshot to shared
            }.collect { (snapshot, shared) ->
                render(snapshot.inRoom, snapshot.state, snapshot.connection, snapshot.log, snapshot.busy, shared)
            }
        }
        viewLifecycleOwner.lifecycleScope.launch {
            roomVm.messages.collect { Toast.makeText(requireContext(), it, Toast.LENGTH_SHORT).show() }
        }
        viewLifecycleOwner.lifecycleScope.launch {
            RoxStarApp.instance.drafts.observe().collect { items ->
                drafts = items
                val labels = items.map { it.name }
                view.draftPicker.adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, labels)
            }
        }
        return view.root
    }

    override fun onResume() {
        super.onResume()
        (activity as? androidx.appcompat.app.AppCompatActivity)?.supportActionBar?.title = "Room"
    }

    private fun shareSelected() {
        val index = binding?.draftPicker?.selectedItemPosition ?: -1
        val draft = drafts.getOrNull(index)
        if (draft == null) {
            Toast.makeText(requireContext(), "Record a draft first.", Toast.LENGTH_SHORT).show()
            return
        }
        roomVm.shareDraft(draft)
    }

    private fun copyRoomCode() {
        val code = RoxStarApp.instance.session.currentRoomCode
        if (code.isNullOrBlank()) {
            Toast.makeText(requireContext(), "No room code yet.", Toast.LENGTH_SHORT).show()
            return
        }
        val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("Room code", code))
        Toast.makeText(requireContext(), "Copied $code", Toast.LENGTH_SHORT).show()
    }

    private fun render(
        inRoom: Boolean,
        state: RoomStateDto?,
        connection: ConnectionStatus,
        log: List<String>,
        busy: Boolean,
        shared: List<String>
    ) {
        val view = binding ?: return
        view.lobby.visibility = if (inRoom) View.GONE else View.VISIBLE
        view.session.visibility = if (inRoom) View.VISIBLE else View.GONE
        view.copyCode.visibility = if (inRoom) View.VISIBLE else View.GONE
        view.createRoom.isEnabled = !busy
        view.joinRoom.isEnabled = !busy
        view.leaveRoom.isEnabled = !busy
        view.shareDraft.isEnabled = !busy
        view.connection.text = "Socket: ${connection.name.lowercase().replaceFirstChar { it.titlecase() }}"
        if (!inRoom) {
            view.title.text = "Join or create a room"
            return
        }
        val room = state?.room
        val code = room?.code ?: RoxStarApp.instance.session.currentRoomCode
        val ownerMark = if (roomVm.isOwner) "  ·  you own this room" else ""
        view.title.text = "Room $code$ownerMark"
        val participants = state?.participants.orEmpty().joinToString("\n") { "• ${it.name}" }.ifBlank { "No participants yet." }
        view.participants.text = participants
        view.sharedDrafts.text = shared.takeLast(8).joinToString("\n").ifBlank { "Nothing shared yet." }
        view.events.text = log.takeLast(12).joinToString("\n").ifBlank { "No realtime events yet." }
    }

    override fun onDestroyView() {
        binding = null
        super.onDestroyView()
    }

    private data class RoomSnapshot(
        val inRoom: Boolean,
        val state: RoomStateDto?,
        val connection: ConnectionStatus,
        val log: List<String>,
        val busy: Boolean
    )
}
