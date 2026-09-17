#include "recorder.h"

#include <jni.h>

namespace {
Recorder gRecorder;

const char* stateName(RecordingState state) {
  switch (state) {
    case RecordingState::Idle:
      return "IDLE";
    case RecordingState::Recording:
      return "RECORDING";
    case RecordingState::Stopping:
      return "STOPPING";
    case RecordingState::Saved:
      return "SAVED";
    case RecordingState::Cancelled:
      return "CANCELLED";
    case RecordingState::Error:
      return "ERROR";
  }
  return "ERROR";
}
}  // namespace

extern "C" JNIEXPORT jboolean JNICALL
Java_com_roxstar_voice_audio_NativeRecorder_nativeStart(JNIEnv* env, jobject /*thiz*/, jstring path, jboolean echo) {
  if (path == nullptr) {
    return JNI_FALSE;
  }
  const char* chars = env->GetStringUTFChars(path, nullptr);
  if (chars == nullptr) {
    return JNI_FALSE;
  }
  const std::string nativePath(chars);
  env->ReleaseStringUTFChars(path, chars);
  return gRecorder.start(nativePath, echo == JNI_TRUE) ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_roxstar_voice_audio_NativeRecorder_nativeStop(JNIEnv* env, jobject /*thiz*/) {
  const std::string path = gRecorder.stop();
  if (path.empty()) {
    return nullptr;
  }
  return env->NewStringUTF(path.c_str());
}

extern "C" JNIEXPORT void JNICALL
Java_com_roxstar_voice_audio_NativeRecorder_nativeCancel(JNIEnv* /*env*/, jobject /*thiz*/) {
  gRecorder.cancel();
}

extern "C" JNIEXPORT void JNICALL
Java_com_roxstar_voice_audio_NativeRecorder_nativeSetEchoEnabled(JNIEnv* /*env*/, jobject /*thiz*/, jboolean echo) {
  gRecorder.setEchoEnabled(echo == JNI_TRUE);
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_roxstar_voice_audio_NativeRecorder_nativeIsRecording(JNIEnv* /*env*/, jobject /*thiz*/) {
  return gRecorder.isRecording() ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jint JNICALL
Java_com_roxstar_voice_audio_NativeRecorder_nativeDurationMs(JNIEnv* /*env*/, jobject /*thiz*/) {
  return gRecorder.durationMs();
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_roxstar_voice_audio_NativeRecorder_nativeState(JNIEnv* env, jobject /*thiz*/) {
  return env->NewStringUTF(stateName(gRecorder.state()));
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_roxstar_voice_audio_NativeRecorder_nativeLastError(JNIEnv* env, jobject /*thiz*/) {
  const std::string error = gRecorder.lastError();
  if (error.empty()) {
    return nullptr;
  }
  return env->NewStringUTF(error.c_str());
}
