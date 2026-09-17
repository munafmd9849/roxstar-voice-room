package com.roxstar.voice.data.remote

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {
    @POST("api/users")
    suspend fun createUser(@Body body: CreateUserRequest): UserDto

    @POST("api/rooms")
    suspend fun createRoom(@Body body: UserIdRequest): RoomStateDto

    @POST("api/rooms/{code}/join")
    suspend fun joinRoom(@Path("code") code: String, @Body body: UserIdRequest): RoomStateDto

    @POST("api/rooms/{id}/leave")
    suspend fun leaveRoom(@Path("id") id: String, @Body body: UserIdRequest): RoomStateDto

    @GET("api/rooms/{id}")
    suspend fun getRoom(@Path("id") id: String): RoomStateDto

    @POST("api/drafts")
    suspend fun createDraft(@Body body: CreateDraftRequest): RemoteDraftDto

    @GET("api/drafts")
    suspend fun listDrafts(@Query("userId") userId: String): List<RemoteDraftDto>

    @GET("api/drafts/{id}")
    suspend fun getDraft(@Path("id") id: String): RemoteDraftDto

    @DELETE("api/drafts/{id}")
    suspend fun deleteDraft(@Path("id") id: String)

    @POST("api/rooms/{roomId}/drafts/share")
    suspend fun shareDraft(@Path("roomId") roomId: String, @Body body: ShareDraftRequest): ShareDraftResponse

    @POST("api/rooms/{roomId}/spin/start")
    suspend fun startSpin(@Path("roomId") roomId: String, @Body body: UserIdRequest): SpinResponse

    @GET("api/rooms/{roomId}/spin")
    suspend fun getSpin(@Path("roomId") roomId: String): SpinResponse
}
