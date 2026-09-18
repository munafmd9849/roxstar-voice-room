package com.roxstar.voice.audio

enum class RecordingState {
    IDLE,
    RECORDING,
    STOPPING,
    SAVED,
    CANCELLED,
    ERROR
}

fun RecordingState.label(): String = when (this) {
    RecordingState.IDLE -> "Ready"
    RecordingState.RECORDING -> "Recording"
    RecordingState.STOPPING -> "Saving"
    RecordingState.SAVED -> "Saved"
    RecordingState.CANCELLED -> "Cancelled"
    RecordingState.ERROR -> "Error"
}
