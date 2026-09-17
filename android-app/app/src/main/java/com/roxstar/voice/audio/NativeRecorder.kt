package com.roxstar.voice.audio

object NativeRecorder {
    init {
        System.loadLibrary("roxstar_audio")
    }

    @Synchronized
    fun start(path: String, echoEnabled: Boolean): Boolean = nativeStart(path, echoEnabled)

    @Synchronized
    fun stop(): String? = nativeStop()

    @Synchronized
    fun cancel() {
        nativeCancel()
    }

    @Synchronized
    fun setEchoEnabled(enabled: Boolean) {
        nativeSetEchoEnabled(enabled)
    }

    fun isRecording(): Boolean = nativeIsRecording()

    fun durationMs(): Int = nativeDurationMs()

    fun state(): RecordingState {
        return runCatching { RecordingState.valueOf(nativeState()) }.getOrDefault(RecordingState.ERROR)
    }

    fun lastError(): String? = nativeLastError()

    private external fun nativeStart(path: String, echoEnabled: Boolean): Boolean
    private external fun nativeStop(): String?
    private external fun nativeCancel()
    private external fun nativeSetEchoEnabled(echoEnabled: Boolean)
    private external fun nativeIsRecording(): Boolean
    private external fun nativeDurationMs(): Int
    private external fun nativeState(): String
    private external fun nativeLastError(): String?
}
