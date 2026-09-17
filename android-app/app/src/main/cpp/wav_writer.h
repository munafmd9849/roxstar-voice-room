#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

bool writeWavFile(const std::string& path, const int16_t* samples, size_t count, int32_t sampleRate);
