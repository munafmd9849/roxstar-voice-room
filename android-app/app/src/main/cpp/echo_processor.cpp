#include "echo_processor.h"

#include <algorithm>

void EchoProcessor::configure(int32_t sampleRate, bool enabled, int delayMs, float decay) {
  enabled_ = enabled;
  decay_ = decay;
  const int safeRate = std::max(sampleRate, 1);
  const int safeDelayMs = std::max(delayMs, 1);
  const size_t size = static_cast<size_t>(safeRate) * static_cast<size_t>(safeDelayMs) / 1000u;
  delay_.assign(std::max<size_t>(size, 1), 0);
  cursor_ = 0;
}

void EchoProcessor::setEnabled(bool enabled) {
  enabled_ = enabled;
}

int16_t EchoProcessor::process(int16_t input) {
  if (!enabled_ || delay_.empty()) {
    return input;
  }

  const int delayed = delay_[cursor_];
  int mixed = static_cast<int>(input) + static_cast<int>(static_cast<float>(delayed) * decay_);
  mixed = std::clamp(mixed, -32768, 32767);
  delay_[cursor_] = input;
  cursor_ = (cursor_ + 1) % delay_.size();
  return static_cast<int16_t>(mixed);
}

void EchoProcessor::reset() {
  std::fill(delay_.begin(), delay_.end(), 0);
  cursor_ = 0;
}
