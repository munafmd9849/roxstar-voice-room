#pragma once

#include <cstdint>
#include <vector>

class EchoProcessor {
 public:
  void configure(int32_t sampleRate, bool enabled, int delayMs = 250, float decay = 0.4f);
  void setEnabled(bool enabled);
  int16_t process(int16_t input);
  void reset();

 private:
  std::vector<int16_t> delay_;
  size_t cursor_ = 0;
  float decay_ = 0.4f;
  bool enabled_ = false;
};
