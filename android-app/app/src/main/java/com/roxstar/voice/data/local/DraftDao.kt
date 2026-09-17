package com.roxstar.voice.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface DraftDao {
    @Query("SELECT * FROM drafts ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<DraftEntity>>

    @Query("SELECT * FROM drafts ORDER BY createdAt DESC")
    suspend fun listAll(): List<DraftEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(draft: DraftEntity)

    @Delete
    suspend fun delete(draft: DraftEntity)

    @Query("SELECT * FROM drafts WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): DraftEntity?
}
