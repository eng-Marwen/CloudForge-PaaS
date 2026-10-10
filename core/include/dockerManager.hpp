#ifndef DOCKER_MANAGER_HPP
#define DOCKER_MANAGER_HPP

#include <filesystem>
#include <string>

#include "deployEvent.hpp"

class DockerManager {
public:
    // "user/cloudforge-<id>-<name>:<timestamp>-<random>", new on every call.
    static std::string getImageName(const DeployEvent& event,
                                    const std::string& repository);

    static bool buildImage(const std::filesystem::path& dockerfilePath,
                           const std::string& imageName,
                           std::string& error);

    static bool login(const std::string& user,
                      const std::string& token,
                      std::string& error);

    static bool pushImage(const std::string& imageName,
                          std::string& error);

    // Removes the image from this machine (best effort).
    static void removeLocalImage(const std::string& imageName);

    // Deletes the tag on Docker Hub. A tag that is already gone counts as success.
    static bool deleteRemoteImage(const std::string& imageName,
                                  const std::string& user,
                                  const std::string& token,
                                  std::string& error);

    static bool getExposedPort(const std::string& imageName,
                               int& port,
                               std::string& error);
};

#endif