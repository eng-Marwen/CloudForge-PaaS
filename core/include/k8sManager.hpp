#ifndef K8S_MANAGER_HPP
#define K8S_MANAGER_HPP

#include <string>

#include "deployEvent.hpp"

class K8sManager {
public:
    // Reads the NodePort Kubernetes assigned and builds "http://<node-ip>:<port>".
    static bool getUrl(const DeployEvent& event,
                       std::string& url,
                       std::string& error);

    // "http://test-25.cloudforge.local[:K8S_INGRESS_PORT]"
    static std::string getUrl(const DeployEvent& event);

    // Fills secret.yml, app.yml and ingress.yml, then kubectl apply.
    static bool apply(const DeployEvent& event,
                      const std::string& image,
                      int port,
                      std::string& error);

    // Waits until the new pods are Ready.
    static bool waitForRollout(const DeployEvent& event, std::string& error);
};

#endif