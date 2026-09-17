package com.roxstar.voice.data.remote

data class CreateUserRequest(val name: String)

data class UserDto(
    val id: String,
    val name: String,
    val createdAt: String? = null
)

data class UserIdRequest(val userId: String)

data class RoomDto(
    val id: String,
    val code: String,
    val ownerId: String,
    val status: String,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

data class ParticipantDto(
    val userId: String,
    val name: String,
    val status: String
)

data class UserRefDto(
    val id: String,
    val name: String
)

data class SpinParticipantDto(
    val userId: String,
    val name: String,
    val status: String,
    val position: Int = 0,
    val eliminationOrder: Int? = null,
    val eliminatedAt: String? = null
)

data class SpinEventDto(
    val type: String,
    val userId: String? = null,
    val sequence: Int = 0,
    val createdAt: String? = null
)

data class SpinDto(
    val id: String,
    val roomId: String,
    val status: String,
    val startedAt: String? = null,
    val completedAt: String? = null,
    val winnerId: String? = null,
    val version: Int = 0,
    val winner: UserRefDto? = null,
    val participants: List<SpinParticipantDto> = emptyList(),
    val events: List<SpinEventDto> = emptyList()
)

data class RoomStateDto(
    val room: RoomDto,
    val participants: List<ParticipantDto> = emptyList(),
    val spin: SpinDto? = null,
    val message: String? = null
)

data class SpinResponse(val spin: SpinDto)

data class CreateDraftRequest(
    val userId: String,
    val name: String,
    val filePath: String,
    val durationMs: Int
)

data class RemoteDraftDto(
    val id: String,
    val name: String,
    val filePath: String? = null,
    val durationMs: Int = 0,
    val createdAt: String? = null
)

data class ShareDraftRequest(
    val userId: String,
    val draftId: String
)

data class ShareDraftResponse(
    val roomId: String? = null,
    val draftId: String? = null,
    val sharedBy: UserRefDto? = null,
    val draft: RemoteDraftDto? = null,
    val sharedAt: String? = null,
    val duplicate: Boolean = false
)

data class ApiErrorBody(val error: ApiError?)

data class ApiError(
    val code: String? = null,
    val message: String? = null
)
