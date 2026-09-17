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
  std::lock_guard<std::mutex> lock(mutex_);
  if (state_ == RecordingState::Recording || state_ == RecordingState::Stopping) {
    lastError_ = "Recording is already in progress.";
    return false;
  }

  closeStreamLocked();
  samples_.clear();
  path_ = path;
  echoEnabled_ = echo;
  lastError_.clear();
  sampleRate_ = kRequestedSampleRate;

  if (!openStreamLocked()) {
    state_ = RecordingState::Error;
    if (lastError_.empty()) {
      lastError_ = "Could not open the microphone stream.";
    }
    return false;
  }

  sampleRate_ = stream_->getSampleRate() > 0 ? stream_->getSampleRate() : kRequestedSampleRate;
  echo_.configure(sampleRate_, echoEnabled_, kEchoDelayMs, kEchoDecay);
  echo_.reset();
  samples_.reserve(static_cast<size_t>(sampleRate_) * kMaxSeconds);

  const oboe::Result started = stream_->requestStart();
  if (started != oboe::Result::OK) {
    closeStreamLocked();
    state_ = RecordingState::Error;
    lastError_ = "Could not start the microphone stream.";
    __android_log_print(ANDROID_LOG_ERROR, kLogTag, "requestStart failed: %s", oboe::convertToText(started));
    return false;
  }

  state_ = RecordingState::Recording;
  return true;
}

std::string Recorder::stop() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (state_ != RecordingState::Recording) {
    return "";
  }

  state_ = RecordingState::Stopping;
  closeStreamLocked();

  if (samples_.empty()) {
    state_ = RecordingState::Error;
    lastError_ = "No audio was captured.";
    std::remove(path_.c_str());
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
  std::lock_guard<std::mutex> lock(mutex_);
  if (state_ == RecordingState::Recording || state_ == RecordingState::Stopping) {
    closeStreamLocked();
  }
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
  std::lock_guard<std::mutex> lock(mutex_);
  return state_ == RecordingState::Recording;
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
  auto* input = static_cast<const int16_t*>(audioData);
  std::lock_guard<std::mutex> lock(mutex_);
  if (state_ != RecordingState::Recording || input == nullptr || numFrames <= 0) {
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
  std::lock_guard<std::mutex> lock(mutex_);
  if (state_ == RecordingState::Recording) {
    stream_.reset();
    state_ = RecordingState::Error;
    lastError_ = "The microphone stream stopped unexpectedly.";
    __android_log_print(ANDROID_LOG_ERROR, kLogTag, "stream error: %s", oboe::convertToText(error));
  }
}

bool Recorder::openStreamLocked() {
  oboe::AudioStreamBuilder builder;
  builder.setDirection(oboe::Direction::Input)
      ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
      ->setSharingMode(oboe::SharingMode::Shared)
      ->setFormat(oboe::AudioFormat::I16)
      ->setChannelCount(oboe::ChannelCount::Mono)
      ->setSampleRate(kRequestedSampleRate)
      ->setSampleRateConversionQuality(oboe::SampleRateConversionQuality::Medium)
      ->setDataCallback(this)
      ->setErrorCallback(this);

  oboe::Result result = builder.openStream(stream_);
  if (result != oboe::Result::OK) {
    builder.setPerformanceMode(oboe::PerformanceMode::None);
    result = builder.openStream(stream_);
  }

  if (result != oboe::Result::OK || !stream_) {
    lastError_ = "Microphone unavailable.";
    __android_log_print(ANDROID_LOG_ERROR, kLogTag, "openStream failed: %s", oboe::convertToText(result));
    stream_.reset();
    return false;
  }
  return true;
}

void Recorder::closeStreamLocked() {
  if (!stream_) {
    return;
  }
  stream_->requestStop();
  stream_->close();
  stream_.reset();
}

int32_t Recorder::durationMsLocked() const {
  if (sampleRate_ <= 0) {
    return 0;
  }
  return static_cast<int32_t>((samples_.size() * 1000ull) / static_cast<uint64_t>(sampleRate_));
}
