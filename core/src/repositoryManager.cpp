
#include "repositoryManager.hpp"

#include <cctype>
#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <string>
#include <system_error>
#include <cerrno>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#include <vector>
namespace fs = std::filesystem;


namespace {

std::string sanitize(const std::string& value)
{
    std::string result;

    for (unsigned char c : value) {
        if (std::isalnum(c) || c == '-' || c == '_') {
            result += static_cast<char>(c);
        } else {
            result += '_';
        }
    }

    return result;
}

} // namespace

fs::path RepositoryManager::getRepositoryPath(const DeployEvent& event)
{
    return fs::path(CLOUDFORGE_REPOS_DIR) /
           (sanitize(event.name) + "_" + sanitize(event.branch));
}

bool RepositoryManager::cloneRepository(const DeployEvent& event)
{
    // 1. Validate the required fields.
    if (event.name.empty() ||
        event.repository.empty() ||
        event.branch.empty()) {
        std::cerr << "Invalid deployment event: missing repository information\n";
        return false;
    }


    // 3. Build a unique folder name using the app, repository, and branch.
    std::string folderName =
        sanitize(event.name) + "_" +
        sanitize(event.branch);

    if (folderName.empty() || folderName == "." || folderName == "..") {
        std::cerr << "Invalid application name\n";
        return false;
    }

    

    // 3. Create the repos parent directory.
    const fs::path reposDirectory =
        fs::path(CLOUDFORGE_REPOS_DIR);

    const fs::path destination = getRepositoryPath(event);

    std::error_code error;

    fs::create_directories(reposDirectory, error);

    if (error) {
        std::cerr << "Could not create repos directory: "
                  << error.message() << '\n';
        return false;
    }

    // 4. Never overwrite an existing application's repository.
    if (fs::exists(destination, error) || error) {
        std::cerr << "Repository directory already exists or cannot be checked: "
                  << destination << '\n';
        return false;
    }

    std::cout << "Cloning repository: " << event.repository << '\n';
    std::cout << "Branch: " << event.branch << '\n';
    std::cout << "Destination: " << destination << '\n';

    // 5. Run git directly, without passing user input through a shell.
    pid_t pid = fork();

    if (pid < 0) {
        std::cerr << "Failed to start git process\n";
        return false;
    }

    if (pid == 0) {
        // Prevent Git from waiting for interactive credentials.
        setenv("GIT_TERMINAL_PROMPT", "0", 1);

        execlp(
            "git",
            "git",
            "clone",
            "--branch", event.branch.c_str(),
            "--single-branch",
            "--",
            event.repository.c_str(),
            destination.c_str(),
            static_cast<char*>(nullptr)
        );

        // Reached only if execlp fails.
        _exit(127);
    }

    // 6. Wait for Git to finish.
    int status = 0;

    while (waitpid(pid, &status, 0) < 0) {
        if (errno == EINTR) {
            continue;
        }

        std::cerr << "Failed while waiting for git process\n";
        return false;
    }

    if (!WIFEXITED(status) || WEXITSTATUS(status) != 0) {
        // Remove a partial clone if Git left one behind.
        fs::remove_all(destination, error);

        std::cerr << "Can't access your GitHub repository\n";
        return false;
    }

    std::cout << "Repository cloned successfully!\n";
    return true;
}




bool RepositoryManager::validateRepository(
    const fs::path& repoPath,
    fs::path& dockerfilePath,
    std::string& error)
{
    std::error_code ec;
    std::vector<fs::path> found;

    fs::recursive_directory_iterator it(repoPath, ec);

    if (ec) {
        error = "Cannot read repository: " + ec.message();
        return false;
    }

    for (const fs::recursive_directory_iterator end; it != end; it.increment(ec)) {
        if (ec) {
            error = "Cannot scan repository: " + ec.message();
            return false;
        }

        const fs::directory_entry& entry = *it;

        // Never look inside .git.
        if (entry.path().filename() == ".git") {
            it.disable_recursion_pending();
            continue;
        }

        // symlink_status: a symlink named Dockerfile does NOT count,
        // so a repo can't point us at a file outside itself.
        if (fs::is_regular_file(entry.symlink_status(ec)) &&
            entry.path().filename() == "Dockerfile") {
            found.push_back(entry.path());
        }
    }

    if (found.empty()) {
        error = "No Dockerfile found in the repository";
        return false;
    }

    if (found.size() > 1) {
        error = "Expected exactly one Dockerfile, found " +
                std::to_string(found.size());
        return false;
    }

    dockerfilePath = found.front();
    return true;
}

void RepositoryManager::removeRepository(const fs::path& repoPath)
{
    std::error_code ec;
    fs::remove_all(repoPath, ec);

    if (ec) {
        std::cerr << "Could not remove " << repoPath << ": "
                  << ec.message() << '\n';
    }
}