#include "wav_writer.h"

#include <fstream>

namespace {

void writeU32(std::ostream& out, uint32_t value) {
  const char bytes[4] = {
      static_cast<char>(value & 0xffu),
      static_cast<char>((value >> 8) & 0xffu),
      static_cast<char>((value >> 16) & 0xffu),
      static_cast<char>((value >> 24) & 0xffu)};
  out.write(bytes, 4);
}

void writeU16(std::ostream& out, uint16_t value) {
  const char bytes[2] = {
      static_cast<char>(value & 0xffu),
      static_cast<char>((value >> 8) & 0xffu)};
  out.write(bytes, 2);
}

}  // namespace

bool writeWavFile(const std::string& path, const int16_t* samples, size_t count, int32_t sampleRate) {
  if (samples == nullptr || count == 0 || sampleRate <= 0) {
    return false;
  }

  std::ofstream out(path, std::ios::binary);
  if (!out) {
    return false;
  }

  const uint32_t dataBytes = static_cast<uint32_t>(count * sizeof(int16_t));
  const uint32_t riffSize = 36u + dataBytes;
  const uint32_t byteRate = static_cast<uint32_t>(sampleRate) * 2u;

  out.write("RIFF", 4);
  writeU32(out, riffSize);
  out.write("WAVE", 4);
  out.write("fmt ", 4);
  writeU32(out, 16);
  writeU16(out, 1);  // PCM
  writeU16(out, 1);  // mono
  writeU32(out, static_cast<uint32_t>(sampleRate));
  writeU32(out, byteRate);
  writeU16(out, 2);   // block align
  writeU16(out, 16);  // bits per sample
  out.write("data", 4);
  writeU32(out, dataBytes);
  out.write(reinterpret_cast<const char*>(samples), static_cast<std::streamsize>(dataBytes));
  return static_cast<bool>(out);
}
