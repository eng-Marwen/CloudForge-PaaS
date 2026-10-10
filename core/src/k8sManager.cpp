#include "k8sManager.hpp"
#include "processUtil.hpp"

#include <cctype>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <vector>
#include <nlohmann/json.hpp>

namespace fs = std::filesystem;
using json = nlohmann::json;

namespace {

std::string envOr(const char* name, const std::string& fallback)
{
    const char* v = std::getenv(name);
    return (v && *v) ? v : fallback;
}

std::string appName(const DeployEvent& event)
{
    return "app-" + std::to_string(event.id);
}

// Lowercase letters/digits/dashes only, no leading or trailing dash.
std::string slug(const std::string& value)
{
    std::string r;

    for (unsigned char c : value) {
        r += std::isalnum(c) ? static_cast<char>(std::tolower(c)) : '-';
    }

    const auto start = r.find_first_not_of('-');
    if (start == std::string::npos) return "app";
    r = r.substr(start);

    if (r.size() > 40) r.resize(40);

    return r.substr(0, r.find_last_not_of('-') + 1);
}

bool validEnvKey(const std::string& key)
{
    if (key.empty() || std::isdigit(static_cast<unsigned char>(key[0]))) return false;

    for (unsigned char c : key) {
        if (!std::isalnum(c) && c != '_') return false;
    }

    return true;
}

std::string tail(const std::string& s, size_t n = 400)
{
    return s.size() <= n ? s : "..." + s.substr(s.size() - n);
}

// kubectl [--context X] <args...>
std::vector<std::string> kubectl(const std::vector<std::string>& args)
{
    std::vector<std::string> cmd = {"kubectl"};

    const std::string ctx = envOr("K8S_CONTEXT", "");
    if (!ctx.empty()) {
        cmd.push_back("--context");
        cmd.push_back(ctx);
    }

    cmd.insert(cmd.end(), args.begin(), args.end());
    return cmd;
}

// Reads k8s/<file> and replaces every {{KEY}} in ONE pass. Inserted values
// are never scanned again, so an env value containing "{{...}}" is harmless.
bool render(const std::string& file,
            const std::map<std::string, std::string>& vars,
            std::string& result,
            std::string& error)
{
    const fs::path path = fs::path(CLOUDFORGE_K8S_DIR) / file;
    std::ifstream in(path);

    if (!in) {
        error = "Cannot read template: " + path.string();
        return false;
    }

    std::stringstream buffer;
    buffer << in.rdbuf();
    const std::string text = buffer.str();

    result.clear();
    size_t i = 0;

    while (i < text.size()) {
        if (text.compare(i, 2, "{{") == 0) {
            const auto end = text.find("}}", i);

            if (end == std::string::npos) {
                error = "Unclosed {{ in template " + file;
                return false;
            }

            const std::string key = text.substr(i + 2, end - i - 2);
            const auto it = vars.find(key);

            if (it == vars.end()) {
                error = "Unknown placeholder {{" + key + "}} in " + file;
                return false;
            }

            result += it->second;
            i = end + 2;
        } else {
            result += text[i++];
        }
    }

    return true;
}

} // namespace



bool K8sManager::apply(const DeployEvent& event,
                       const std::string& image,
                       int port,
                       std::string& error)
{
    // App env vars -> YAML lines. Keys and values are written as JSON strings,
    // which are valid YAML, so quotes/newlines/colons can't break the file.
    std::string envYaml;

    for (const auto& v : event.environmentVariables) {
        if (!validEnvKey(v.key)) {
            error = "Invalid environment variable name: " + v.key;
            return false;
        }

        envYaml += "  " +
                   json(v.key).dump() + ": " +
                   json(v.value).dump(-1, ' ', false, json::error_handler_t::replace) +
                   "\n";
    }

    if (envYaml.empty()) envYaml = "  {}\n";   // empty Secret

    const std::map<std::string, std::string> vars = {
        {"NAME",          appName(event)},
        {"NAMESPACE",     envOr("K8S_NAMESPACE", "cloudforge")},
        {"IMAGE",         image},
        {"PORT",          std::to_string(port)},
        {"ENV_VARS",      envYaml}
    };

    // secret -> app (deployment + service) -> ingress, as one multi-document YAML.
    std::string manifest;

    for (const char* file : {"secret.yml", "app.yml"}) {
        std::string part;

        if (!render(file, vars, part, error)) return false;

        if (!manifest.empty()) manifest += "\n---\n";
        manifest += part;
    }

    std::cout << "Applying manifests for " << appName(event) << '\n';

    // Via stdin: the secret values never touch the disk or the process list.
    std::string out;
    const int code = runProcess(kubectl({"apply", "-f", "-"}),
                                &manifest, &out, true);

    if (code == 127) {
        error = "kubectl is not installed or not in PATH";
        return false;
    }

    if (code != 0) {
        error = "kubectl apply failed: " + tail(out);
        return false;
    }

    std::cout << out;
    return true;
}

bool K8sManager::waitForRollout(const DeployEvent& event, std::string& error)
{
    std::string out;

    std::cout << "Waiting for " << appName(event) << " to become ready...\n";

    const int code = runProcess(
        kubectl({"rollout", "status", "deployment/" + appName(event),
                 "-n", envOr("K8S_NAMESPACE", "cloudforge"),
                 "--timeout=120s"}),
        nullptr, &out, true);

    if (code != 0) {
        error = "Pods did not become ready: " + tail(out);
        return false;
    }

    std::cout << out;
    return true;
}

bool K8sManager::getUrl(const DeployEvent& event,
                        std::string& url,
                        std::string& error)
{
    auto trim = [](std::string s) {
        while (!s.empty() && std::isspace(static_cast<unsigned char>(s.back()))) s.pop_back();
        return s;
    };

    const std::string ns = envOr("K8S_NAMESPACE", "cloudforge");

    // The port Kubernetes picked for this app's Service.
    std::string portOut;

    if (runProcess(kubectl({"get", "svc", appName(event), "-n", ns,
                            "-o", "jsonpath={.spec.ports[0].nodePort}"}),
                   nullptr, &portOut) != 0 || trim(portOut).empty()) {
        error = "Could not read the NodePort of the service";
        return false;
    }

    // Any node works: a NodePort is open on every node. K8S_NODE_IP overrides.
    std::string ip = envOr("K8S_NODE_IP", "");

    if (ip.empty()) {
        std::string ipOut;

        if (runProcess(kubectl({"get", "nodes", "-o",
                "jsonpath={.items[0].status.addresses[?(@.type==\"InternalIP\")].address}"}),
                       nullptr, &ipOut) != 0 || trim(ipOut).empty()) {
            error = "Could not find a node IP (set K8S_NODE_IP in .env)";
            return false;
        }

        ip = trim(ipOut);
    }

    url = "http://" + ip + ":" + trim(portOut);
    return true;
}

