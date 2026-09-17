cmake_minimum_required(VERSION 3.22.1)
project(roxstar_audio)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(roxstar_audio SHARED
    echo_processor.cpp
    wav_writer.cpp
    recorder.cpp
    jni_bridge.cpp
)

find_package(oboe REQUIRED CONFIG)

target_include_directories(roxstar_audio PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(roxstar_audio oboe::oboe android log)
