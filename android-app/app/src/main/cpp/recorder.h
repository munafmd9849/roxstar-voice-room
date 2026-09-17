#pragma once

#include <oboe/Oboe.h>

#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

#include "echo_processor.h"

enum class RecordingState {
  Idle,
  Recording,
  Stopping,
  Saved,
  Cancelled,
  Error
};

class Recorder : public oboe::AudioStreamDataCallback, public oboe::AudioStreamErrorCallback {
 public:
  bool start(const std::string& path, bool echo);
  std::string stop();
  void cancel();
  void setEchoEnabled(bool enabled);

  bool isRecording() const;
  RecordingState state() const;
  int32_t durationMs() const;
  std::string lastError() const;

  oboe::DataCallbackResult onAudioReady(
      oboe::AudioStream* audioStream,
      void* audioData,
      int32_t numFrames) override;

  void onErrorAfterClose(oboe::AudioStream* audioStream, oboe::Result error) override;

 private:
  bool openStreamLocked();
  void closeStreamLocked();
  int32_t durationMsLocked() const;

  mutable std::mutex mutex_;
  std::shared_ptr<oboe::AudioStream> stream_;
  EchoProcessor echo_;
  std::vector<int16_t> samples_;
  std::string path_;
  std::string lastError_;
  RecordingState state_{RecordingState::Idle};
  int32_t sampleRate_{44100};
  bool echoEnabled_{false};
};
