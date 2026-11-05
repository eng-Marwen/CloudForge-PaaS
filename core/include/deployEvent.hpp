#ifndef DEPLOY_EVENT_HPP
#define DEPLOY_EVENT_HPP

#include <string>
#include <vector>
#include <nlohmann/json.hpp>//allows you to parse, create, read, and modify JSON data.
//PURPOSE: convert a json file into cpp DeployEvent object
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

    static DeployEvent fromJson(const nlohmann::json& data);//function returns DeployEvent
};

#endif
//==========Notes================
//The function belongs to the class itself. You can call it without creating a DeployEvent object first.
//nlohmann::json var type for json file
//normal case DeployEvent obj;obj.funcCall();
//our case we want to create an object from json 
// DeployEvent obj= DeployEvent::fromjson()
//static usecase is when you want to create a new object
//from existing data without needing an object beforehand.
// nlohmann::json data = {
//     {"id", 24},
//     {"name", "my-app"}
// };

// int id1 = data["id"];       // Using []
// int id2 = data.at("id");    // Using .at()
