#include "dockerManager.hpp"

#include <cctype>
#include <cerrno>
#include <csignal>
#include <iostream>
#include <vector>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#include <cstdio>
#include <ctime>
#include <random>
#include "processUtil.hpp"
#include <cstdlib>
#include <nlohmann/json.hpp>
namespace fs = std::filesystem;

namespace {

// Lowercase, only [a-z0-9-]; Docker repository names are strict.
std::string dockerSafe(const std::string& value)
{
    std::string result;

    for (unsigned char c : value) {
        if (std::isalnum(c)) {
            result += static_cast<char>(std::tolower(c));
        } else {
            result += '-';
        }
    }

    return result;
}




// Tag like 20261010153012-a3f9c1 (timestamp + random), unique per deployment.
std::string uniqueTag()
{
    char stamp[32];
    const std::time_t now = std::time(nullptr);
    std::tm utc{};
    gmtime_r(&now, &utc);
    std::strftime(stamp, sizeof(stamp), "%Y%m%d%H%M%S", &utc);

    std::random_device rd;
    std::uniform_int_distribution<unsigned> dist(0, 0xFFFFFF);
    char suffix[8];
    std::snprintf(suffix, sizeof(suffix), "%06x", dist(rd));

    return std::string(stamp) + "-" + suffix;
}


} // namespace

std::string DockerManager::getImageName(const DeployEvent& event,
                                        const std::string& repository)
{
    // Cap the name so the tag stays well under Docker's 128-character limit.
    std::string name = dockerSafe(event.name);
    if (name.size() > 40) name.resize(40);

    // repository:<id>-<name>-<timestamp>-<random>
    return repository + ":" + std::to_string(event.id) + "-" + name +
           "-" + uniqueTag();
}

bool DockerManager::buildImage(const fs::path& dockerfilePath,
                               const std::string& imageName,
                               std::string& error)
{
    std::cout << "Building image: " << imageName << '\n';

    int code = runProcess({
        "docker", "build",
        "-t", imageName,
        "-f", dockerfilePath.string(),
        dockerfilePath.parent_path().string()   // build context
    });

    if (code == 127) {
        error = "Docker is not installed or not in PATH";
        return false;
    }

    if (code != 0) {
        error = "docker build failed (exit code " + std::to_string(code) + ")";
        return false;
    }

    std::cout << "Image built successfully\n";
    return true;
}

bool DockerManager::login(const std::string& user,
                          const std::string& token,
                          std::string& error)
{
    int code = runProcess(
        {"docker", "login", "--username", user, "--password-stdin"},
        &token
    );

    if (code != 0) {
        error = "Docker Hub login failed (check DOCKERHUB_USERNAME / DOCKERHUB_TOKEN)";
        return false;
    }

    return true;
}

bool DockerManager::pushImage(const std::string& imageName,
                              std::string& error)
{
    std::cout << "Pushing image: " << imageName << '\n';

    int code = runProcess({"docker", "push", imageName});

    if (code != 0) {
        error = "docker push failed (exit code " + std::to_string(code) + ")";
        return false;
    }

    std::cout << "Image pushed successfully\n";
    return true;
}

bool DockerManager::getExposedPort(const std::string& imageName,
                                   int& port,
                                   std::string& error)
{
    std::string out;

    const int code = runProcess(
        {"docker", "image", "inspect",
         "--format", "{{json .Config.ExposedPorts}}", imageName},
        nullptr, &out);

    if (code != 0) {
        error = "Could not inspect the built image";
        return false;
    }

    // Looks like {"3000/tcp":{}}, or null when there is no EXPOSE.
    const auto json = nlohmann::json::parse(out, nullptr, false);
    int best = 0;

    if (!json.is_discarded() && json.is_object()) {
        for (auto it = json.begin(); it != json.end(); ++it) {
            const int p = std::atoi(it.key().c_str());   // "3000/tcp" -> 3000
            if (p > 0 && (best == 0 || p < best)) best = p;
        }
    }

    if (best == 0) {
        error = "The Dockerfile must EXPOSE the port the app listens on";
        return false;
    }

    port = best;
    return true;
}