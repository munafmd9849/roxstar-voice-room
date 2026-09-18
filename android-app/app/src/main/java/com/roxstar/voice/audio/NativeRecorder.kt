package com.roxstar.voice.audio

object NativeRecorder {
    private val nativeReady = runCatching {
        System.loadLibrary("roxstar_audio")
        true
    }.getOrDefault(false)

    private fun ensureLoaded(): Boolean = nativeReady

    @Synchronized
    fun start(path: String, echoEnabled: Boolean): Boolean {
        if (!ensureLoaded()) return false
        return nativeStart(path, echoEnabled)
    }

    @Synchronized
    fun stop(): String? {
        if (!ensureLoaded()) return null
        return nativeStop()
    }

    @Synchronized
    fun cancel() {
        if (!ensureLoaded()) return
        nativeCancel()
    }

    @Synchronized
    fun setEchoEnabled(enabled: Boolean) {
        if (!ensureLoaded()) return
        nativeSetEchoEnabled(enabled)
    }

    fun isRecording(): Boolean = ensureLoaded() && nativeIsRecording()

    fun durationMs(): Int = if (ensureLoaded()) nativeDurationMs() else 0

    fun state(): RecordingState {
        if (!ensureLoaded()) return RecordingState.ERROR
        return runCatching { RecordingState.valueOf(nativeState()) }.getOrDefault(RecordingState.ERROR)
    }

    fun lastError(): String? {
        if (!ensureLoaded()) return "Native audio library failed to load on this device."
        return nativeLastError()
    }

    private external fun nativeStart(path: String, echoEnabled: Boolean): Boolean
    private external fun nativeStop(): String?
    private external fun nativeCancel()
    private external fun nativeSetEchoEnabled(echoEnabled: Boolean)
    private external fun nativeIsRecording(): Boolean
    private external fun nativeDurationMs(): Int
    private external fun nativeState(): String
    private external fun nativeLastError(): String?
}
