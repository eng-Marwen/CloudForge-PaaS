#ifndef DEPLOY_EVENT_HPP
#define DEPLOY_EVENT_HPP

#include <string>
#include <vector>
#include <nlohmann/json.hpp>

struct EnvironmentVariable
{
    std::string key;
    std::string value;
};

class DeployEvent
{
public:
    int id = -1;
    int userId = -1;

    std::string name;
    std::string repository;
    std::string branch;

    bool isDeployed = false;
    std::string status;

    std::vector<EnvironmentVariable> environmentVariables;

    static DeployEvent fromJson(const nlohmann::json& data);
};

#endif
