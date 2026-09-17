package com.roxstar.voice.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.roxstar.voice.data.local.DraftEntity
import com.roxstar.voice.databinding.ItemDraftBinding
import com.roxstar.voice.util.formatDuration
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DraftAdapter(
    private val onPlay: (DraftEntity) -> Unit,
    private val onDelete: (DraftEntity) -> Unit
) : RecyclerView.Adapter<DraftAdapter.Holder>() {
    private val items = mutableListOf<DraftEntity>()
    private val dateFormat = SimpleDateFormat("MMM d, HH:mm", Locale.getDefault())

    fun submit(drafts: List<DraftEntity>) {
        items.clear()
        items.addAll(drafts)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val binding = ItemDraftBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return Holder(binding)
    }

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val draft = items[position]
        holder.binding.name.text = draft.name
        val effect = if (draft.echoEnabled) "Echo" else "Dry"
        holder.binding.meta.text = "${formatDuration(draft.durationMs)}  •  $effect  •  ${dateFormat.format(Date(draft.createdAt))}"
        holder.binding.play.setOnClickListener { onPlay(draft) }
        holder.binding.delete.setOnClickListener { onDelete(draft) }
    }

    override fun getItemCount(): Int = items.size

    class Holder(val binding: ItemDraftBinding) : RecyclerView.ViewHolder(binding.root)
}
