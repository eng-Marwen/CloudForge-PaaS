#ifndef REPOSITORY_MANAGER_HPP
#define REPOSITORY_MANAGER_HPP

#include <filesystem>
#include <string>

#include "deployEvent.hpp"

class RepositoryManager {
public:
    static bool cloneRepository(const DeployEvent& event);

    // Where the repo of this event lives on disk.
    static std::filesystem::path getRepositoryPath(const DeployEvent& event);

    // Checks the repo contains exactly one Dockerfile.
    // On success, dockerfilePath is set. On failure, error says why.
    static bool validateRepository(
        const std::filesystem::path& repoPath,
        std::filesystem::path& dockerfilePath,
        std::string& error
    );

    // Deletes a repo directory (used after a failed validation).
    static void removeRepository(const std::filesystem::path& repoPath);
};

#endif