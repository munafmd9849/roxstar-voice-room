package com.roxstar.voice.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import com.roxstar.voice.databinding.FragmentSpinBinding
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

class SpinFragment : Fragment() {
    private var binding: FragmentSpinBinding? = null
    private val roomVm: RoomViewModel by activityViewModels()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val view = FragmentSpinBinding.inflate(inflater, container, false)
        binding = view
        view.startSpin.setOnClickListener { roomVm.startSpin() }
        viewLifecycleOwner.lifecycleScope.launch {
            combine(roomVm.roomState, roomVm.busy) { state, busy -> state to busy }.collect { (state, busy) ->
                val spin = state?.spin
                view.status.text = "Status: ${spin?.status ?: "WAITING"}"
                view.startSpin.isEnabled = !busy && roomVm.isOwner
                view.startSpin.visibility = if (roomVm.isOwner) View.VISIBLE else View.GONE
                view.ownerHint.visibility = if (roomVm.isOwner) View.GONE else View.VISIBLE
                val participants = spin?.participants.orEmpty()
                view.remaining.text = if (participants.isEmpty()) {
                    "Participants will appear when a spin starts."
                } else {
                    participants.joinToString("\n") { participant ->
                        val mark = if (participant.status == "ELIMINATED") "✗" else "✓"
                        "$mark ${participant.name} (${participant.status})"
                    }
                }
                val lastEliminated = participants
                    .filter { it.status == "ELIMINATED" }
                    .maxByOrNull { it.eliminationOrder ?: -1 }
                view.lastEliminated.text = "Last eliminated: ${lastEliminated?.name ?: "—"}"
                val winnerName = spin?.winner?.name
                    ?: participants.firstOrNull { it.status == "WINNER" }?.name
                view.winner.text = "Winner: ${winnerName ?: if (spin?.status == "RUNNING") "Waiting..." else "—"}"
            }
        }
        viewLifecycleOwner.lifecycleScope.launch {
            roomVm.messages.collect { Toast.makeText(requireContext(), it, Toast.LENGTH_SHORT).show() }
        }
        return view.root
    }

    override fun onResume() {
        super.onResume()
        (activity as? androidx.appcompat.app.AppCompatActivity)?.supportActionBar?.title = "Spin"
    }

    override fun onDestroyView() {
        binding = null
        super.onDestroyView()
    }
}
