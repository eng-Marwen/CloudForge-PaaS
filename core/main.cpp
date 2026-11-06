#include "queue.hpp"

#include <cstdlib>
#include <fstream>
#include <string>

namespace {

void loadEnvironmentFile()
{
    std::ifstream file(CLOUDFORGE_ENV_FILE);
    if (!file) {
        return;
    }

    std::string line;
    while (std::getline(file, line)) {
        const auto first = line.find_first_not_of(" \t");
        if (first == std::string::npos || line[first] == '#') {
            continue;
        }

        const auto separator = line.find('=', first);
        if (separator == std::string::npos) {
            continue;
        }

        const auto keyEnd = line.find_last_not_of(" \t", separator - 1);
        const std::string key = line.substr(first, keyEnd - first + 1);
        const auto valueStart = line.find_first_not_of(" \t", separator + 1);
        if (valueStart == std::string::npos) {
            continue;
        }

        std::string value = line.substr(valueStart);
        if (value.size() >= 2 &&
            ((value.front() == '"' && value.back() == '"') ||
             (value.front() == '\'' && value.back() == '\''))) {
            value = value.substr(1, value.size() - 2);
        }

        if (std::getenv(key.c_str()) == nullptr) {
            setenv(key.c_str(), value.c_str(), 0);
        }
    }
}

} // namespace

int main()
{
    loadEnvironmentFile();

    Queue queue("deploy.events");

    queue.consume();

    return 0;
}
