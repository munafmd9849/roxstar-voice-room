#include "recorder.h"

#include "wav_writer.h"

#include <android/log.h>

#include <cstdio>

namespace {
constexpr const char* kLogTag = "RoxStarRecorder";
constexpr int32_t kRequestedSampleRate = 44100;
constexpr int kEchoDelayMs = 250;
constexpr float kEchoDecay = 0.4f;
constexpr size_t kMaxSeconds = 10 * 60;
}  // namespace

bool Recorder::start(const std::string& path, bool echo) {
  capturing_.store(false);
  closeStream();

  {
    std::lock_guard<std::mutex> lock(mutex_);
    if (state_ == RecordingState::Recording || state_ == RecordingState::Stopping) {
      lastError_ = "Recording is already in progress.";
      return false;
    }

    samples_.clear();
    path_ = path;
    echoEnabled_ = echo;
    lastError_.clear();
    sampleRate_ = kRequestedSampleRate;

    if (!openStream()) {
      state_ = RecordingState::Error;
      if (lastError_.empty()) {
        lastError_ = "Could not open the microphone stream.";
      }
      return false;
    }

    sampleRate_ = stream_ && stream_->getSampleRate() > 0 ? stream_->getSampleRate() : kRequestedSampleRate;
    echo_.configure(sampleRate_, echoEnabled_, kEchoDelayMs, kEchoDecay);
    echo_.reset();
    samples_.reserve(static_cast<size_t>(sampleRate_) * kMaxSeconds);
    state_ = RecordingState::Recording;
  }

  capturing_.store(true);
  const oboe::Result started = stream_->requestStart();
  if (started != oboe::Result::OK) {
    capturing_.store(false);
    closeStream();
    std::lock_guard<std::mutex> lock(mutex_);
    state_ = RecordingState::Error;
    lastError_ = "Could not start the microphone stream.";
    __android_log_print(ANDROID_LOG_ERROR, kLogTag, "requestStart failed: %s", oboe::convertToText(started));
    return false;
  }
  return true;
}

std::string Recorder::stop() {
  capturing_.store(false);
  closeStream();

  std::lock_guard<std::mutex> lock(mutex_);
  if (state_ != RecordingState::Recording && state_ != RecordingState::Stopping) {
    if (state_ == RecordingState::Saved) {
      return path_;
    }
    return "";
  }

  state_ = RecordingState::Stopping;

  if (samples_.empty()) {
    state_ = RecordingState::Error;
    lastError_ = "No audio was captured. Allow microphone permission and try again.";
    if (!path_.empty()) {
      std::remove(path_.c_str());
    }
    return "";
  }

  if (!writeWavFile(path_, samples_.data(), samples_.size(), sampleRate_)) {
    state_ = RecordingState::Error;
    lastError_ = "Failed to write a playable WAV file.";
    std::remove(path_.c_str());
    return "";
  }

  state_ = RecordingState::Saved;
  return path_;
}

void Recorder::cancel() {
  capturing_.store(false);
  closeStream();
  std::lock_guard<std::mutex> lock(mutex_);
  samples_.clear();
  if (!path_.empty()) {
    std::remove(path_.c_str());
  }
  state_ = RecordingState::Cancelled;
  lastError_.clear();
}

void Recorder::setEchoEnabled(bool enabled) {
  std::lock_guard<std::mutex> lock(mutex_);
  echoEnabled_ = enabled;
  echo_.setEnabled(enabled);
}

bool Recorder::isRecording() const {
  return capturing_.load() && state() == RecordingState::Recording;
}

RecordingState Recorder::state() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return state_;
}

int32_t Recorder::durationMs() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return durationMsLocked();
}

std::string Recorder::lastError() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return lastError_;
}

oboe::DataCallbackResult Recorder::onAudioReady(
    oboe::AudioStream* /*audioStream*/,
    void* audioData,
    int32_t numFrames) {
  if (!capturing_.load()) {
    return oboe::DataCallbackResult::Stop;
  }
  auto* input = static_cast<const int16_t*>(audioData);
  if (input == nullptr || numFrames <= 0) {
    return oboe::DataCallbackResult::Continue;
  }

  std::lock_guard<std::mutex> lock(mutex_);
  if (state_ != RecordingState::Recording) {
    return oboe::DataCallbackResult::Stop;
  }

  const size_t maxSamples = static_cast<size_t>(sampleRate_) * kMaxSeconds;
  for (int32_t i = 0; i < numFrames; ++i) {
    if (samples_.size() >= maxSamples) {
      break;
    }
    samples_.push_back(echo_.process(input[i]));
  }
  return oboe::DataCallbackResult::Continue;
}

void Recorder::onErrorAfterClose(oboe::AudioStream* /*audioStream*/, oboe::Result error) {
  capturing_.store(false);
  std::unique_lock<std::mutex> lock(mutex_, std::try_to_lock);
  if (!lock.owns_lock()) {
    return;
  }
  stream_.reset();
  if (state_ == RecordingState::Recording) {
    state_ = RecordingState::Error;
    lastError_ = "The microphone stream stopped unexpectedly.";
    __android_log_print(ANDROID_LOG_ERROR, kLogTag, "stream error: %s", oboe::convertToText(error));
  }
}

bool Recorder::openStream() {
  auto tryOpen = [this](oboe::AudioApi api, oboe::PerformanceMode performance) -> oboe::Result {
    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Input)
        ->setAudioApi(api)
        ->setPerformanceMode(performance)
        ->setSharingMode(oboe::SharingMode::Shared)
        ->setFormat(oboe::AudioFormat::I16)
        ->setChannelCount(oboe::ChannelCount::Mono)
        ->setSampleRate(kRequestedSampleRate)
        ->setSampleRateConversionQuality(oboe::SampleRateConversionQuality::Medium)
        ->setInputPreset(oboe::InputPreset::VoiceRecognition)
        ->setDataCallback(this)
        ->setErrorCallback(this);
    return builder.openStream(stream_);
  };

  oboe::Result result = tryOpen(oboe::AudioApi::Unspecified, oboe::PerformanceMode::LowLatency);
  if (result != oboe::Result::OK) {
    result = tryOpen(oboe::AudioApi::Unspecified, oboe::PerformanceMode::None);
  }
  if (result != oboe::Result::OK) {
    result = tryOpen(oboe::AudioApi::OpenSLES, oboe::PerformanceMode::None);
  }

  if (result != oboe::Result::OK || !stream_) {
    lastError_ = "Microphone unavailable.";
    __android_log_print(ANDROID_LOG_ERROR, kLogTag, "openStream failed: %s", oboe::convertToText(result));
    stream_.reset();
    return false;
  }
  return true;
}

void Recorder::closeStream() {
  auto local = stream_;
  stream_.reset();
  if (!local) {
    return;
  }
  local->requestStop();
  local->close();
}

int32_t Recorder::durationMsLocked() const {
  if (sampleRate_ <= 0) {
    return 0;
  }
  return static_cast<int32_t>((samples_.size() * 1000ull) / static_cast<uint64_t>(sampleRate_));
}
