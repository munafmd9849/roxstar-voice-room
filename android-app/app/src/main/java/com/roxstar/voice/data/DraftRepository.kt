package com.roxstar.voice.data

import android.content.Context
import com.roxstar.voice.data.local.AppDatabase
import com.roxstar.voice.data.local.DraftEntity
import com.roxstar.voice.data.remote.ApiClient
import com.roxstar.voice.data.remote.CreateDraftRequest
import java.io.File
import java.util.UUID
import kotlinx.coroutines.flow.Flow

class DraftRepository(
    private val context: Context,
    private val db: AppDatabase,
    private val api: ApiClient
) {
    fun observe(): Flow<List<DraftEntity>> = db.draftDao().observeAll()

    suspend fun list(): List<DraftEntity> = db.draftDao().listAll()

    suspend fun saveLocalAndRemote(
        name: String,
        wavPath: String,
        durationMs: Int,
        echoEnabled: Boolean,
        userId: String
    ): DraftEntity {
        val draftsDir = File(context.filesDir, "drafts").apply { mkdirs() }
        val localId = UUID.randomUUID().toString()
        val destination = File(draftsDir, "$localId.wav")
        val source = File(wavPath)
        if (source.absolutePath != destination.absolutePath) {
            if (!source.renameTo(destination)) {
                source.copyTo(destination, overwrite = true)
                source.delete()
            }
        }

        var backendId: String? = null
        runCatching {
            backendId = api.call {
                createDraft(
                    CreateDraftRequest(
                        userId = userId,
                        name = name,
                        filePath = destination.absolutePath,
                        durationMs = durationMs.coerceAtLeast(1)
                    )
                )
            }.id
        }

        val entity = DraftEntity(
            id = backendId ?: localId,
            name = name,
            filePath = destination.absolutePath,
            durationMs = durationMs,
            createdAt = System.currentTimeMillis(),
            echoEnabled = echoEnabled,
            backendId = backendId
        )
        db.draftDao().upsert(entity)
        return entity
    }

    suspend fun ensureBackendId(entity: DraftEntity, userId: String): DraftEntity {
        entity.backendId?.let { return entity }
        val remote = api.call {
            createDraft(
                CreateDraftRequest(
                    userId = userId,
                    name = entity.name,
                    filePath = entity.filePath,
                    durationMs = entity.durationMs.coerceAtLeast(1)
                )
            )
        }
        val updated = entity.copy(id = remote.id, backendId = remote.id)
        db.draftDao().delete(entity)
        db.draftDao().upsert(updated)
        return updated
    }

    suspend fun delete(entity: DraftEntity) {
        runCatching { File(entity.filePath).takeIf { it.exists() }?.delete() }
        db.draftDao().delete(entity)
        val remoteId = entity.backendId ?: entity.id
        runCatching { api.call { deleteDraft(remoteId) } }
    }
}
