#include "deployEvent.hpp"

DeployEvent DeployEvent::fromJson(const nlohmann::json& data)
{
    DeployEvent event;

    event.id = data.at("id");
    event.userId = data.at("userId");

    event.name = data.at("name");
    event.repository = data.at("repository");
    event.branch = data.at("branch");

    event.isDeployed = data.at("isDeployed");
    event.status = data.at("status");

    for (const auto& env : data.at("environmentVariables"))
    {
        EnvironmentVariable variable;

        variable.key = env.at("key");
        variable.value = env.at("value");

        event.environmentVariables.push_back(variable);
    }

    return event;
}
