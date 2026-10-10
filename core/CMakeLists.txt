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
    src/dockerManager.cpp
    src/k8sManager.cpp
    src/processUtil.cpp
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
    CLOUDFORGE_K8S_DIR="${CMAKE_SOURCE_DIR}/k8s"
)

#============================================
# env vars from .env (local to `make run` only)
#============================================
set(ENV_FILE "${CMAKE_SOURCE_DIR}/.env")

# Re-read .env automatically when it changes.
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS "${ENV_FILE}")

file(STRINGS "${ENV_FILE}" ENV_VARS
     REGEX "^(DOCKERHUB_[A-Z_]+|K8S_[A-Z_]+|APP_BASE_DOMAIN)=")

add_custom_target(run
    COMMAND ${CMAKE_COMMAND} -E env ${ENV_VARS} $<TARGET_FILE:cloudforge_core>
    DEPENDS cloudforge_core
    USES_TERMINAL
    VERBATIM
)