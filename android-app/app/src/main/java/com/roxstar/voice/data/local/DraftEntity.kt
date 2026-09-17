package com.roxstar.voice.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "drafts")
data class DraftEntity(
    @PrimaryKey val id: String,
    val name: String,
    val filePath: String,
    val durationMs: Int,
    val createdAt: Long,
    val echoEnabled: Boolean,
    val backendId: String?
)
