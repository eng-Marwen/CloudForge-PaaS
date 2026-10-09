cmake_minimum_required(VERSION 3.22)

project(CloudForgeCore
    VERSION 1.0
    LANGUAGES CXX
)

# C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
# ==========================================
# RabbitMQ C library
# ==========================================

find_path(RABBITMQ_INCLUDE_DIR
    NAMES amqp.h
    PATHS
        /usr/include
        /usr/local/include
)

find_library(RABBITMQ_LIBRARY
    NAMES rabbitmq
    PATHS
        /usr/lib
        /usr/local/lib
)

if(NOT RABBITMQ_INCLUDE_DIR OR NOT RABBITMQ_LIBRARY)
    message(FATAL_ERROR
        "RabbitMQ C library not found.\n"
        "Install it with:\n"
        "sudo apt install librabbitmq-dev"
    )
endif()

# ==========================================
# Executable
# ==========================================

add_executable(cloudforge_core
    main.cpp
    src/queue.cpp
    src/deployEvent.cpp
    src/repositoryManager.cpp
)

# ==========================================
# Include directories
# ==========================================

target_include_directories(cloudforge_core
    PRIVATE
        ${CMAKE_SOURCE_DIR}/include/
        ${RABBITMQ_INCLUDE_DIR}
)

# ==========================================
# Libraries
# ==========================================

target_link_libraries(cloudforge_core
    PRIVATE
        ${RABBITMQ_LIBRARY}
)

# ========================================== 
# nlohmann/json 
# ==========================================
find_package(nlohmann_json REQUIRED)

target_link_libraries(cloudforge_core
    PRIVATE
    nlohmann_json::nlohmann_json
)

target_compile_definitions(cloudforge_core PRIVATE
    CLOUDFORGE_REPOS_DIR="${CMAKE_SOURCE_DIR}/repos"
)