package com.roxstar.voice.ui

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
        roomVm.restoreIfNeeded()
        viewLifecycleOwner.lifecycleScope.launch {
            combine(roomVm.inRoom, roomVm.roomState, roomVm.connection, roomVm.log, roomVm.busy) { inRoom, state, connection, log, busy ->
                render(inRoom, state, connection, log, busy)
            }.collect { }
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

    private fun shareSelected() {
        val index = binding?.draftPicker?.selectedItemPosition ?: -1
        val draft = drafts.getOrNull(index)
        if (draft == null) {
            Toast.makeText(requireContext(), "Record a draft first.", Toast.LENGTH_SHORT).show()
            return
        }
        roomVm.shareDraft(draft)
    }

    private fun render(
        inRoom: Boolean,
        state: com.roxstar.voice.data.remote.RoomStateDto?,
        connection: ConnectionStatus,
        log: List<String>,
        busy: Boolean
    ) {
        val view = binding ?: return
        view.lobby.visibility = if (inRoom) View.GONE else View.VISIBLE
        view.session.visibility = if (inRoom) View.VISIBLE else View.GONE
        view.createRoom.isEnabled = !busy
        view.joinRoom.isEnabled = !busy
        view.leaveRoom.isEnabled = !busy
        view.shareDraft.isEnabled = !busy
        view.connection.text = "Socket: ${connection.name.lowercase().replaceFirstChar { it.titlecase() }}"
        if (!inRoom) {
            view.title.text = "Room"
            return
        }
        val room = state?.room
        view.title.text = "Room: ${room?.code ?: RoxStarApp.instance.session.currentRoomCode}"
        val participants = state?.participants.orEmpty().joinToString("\n") { "• ${it.name}" }.ifBlank { "No participants yet." }
        view.participants.text = participants
        view.events.text = log.takeLast(12).joinToString("\n").ifBlank { "No realtime events yet." }
    }

    override fun onDestroyView() {
        binding = null
        super.onDestroyView()
    }
}
