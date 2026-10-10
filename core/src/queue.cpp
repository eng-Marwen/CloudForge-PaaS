#include "queue.hpp"
#include "repositoryManager.hpp"
#include "dockerManager.hpp"
#include "k8sManager.hpp"
#include <cstdlib>
#include <iostream>
#include <optional>
#include <amqp.h>
#include <amqp_tcp_socket.h>
#include <stdexcept>
#include <nlohmann/json.hpp>
#include <filesystem>

// Queue the Node backend listens on for deployment outcomes.
static const char* RESULTS_QUEUE = "deployment.results";

//ClassName::Methos()---->  define methods outside the class
Queue::Queue(const std::string& queueName)
    : queueName(queueName)
{
}
//we use this method we initialize the object  with  the att if using this-> or normal assignnt
//we initialize the class and att then we assign to it the vlaue .The first approach is used when we have const attributes

void Queue::consume()
{
    const char* host = "localhost";
    const int port = 5672;

    // Create RabbitMQ connection
    amqp_connection_state_t connection =
        amqp_new_connection();

    // Create TCP socket
    amqp_socket_t* socket =
        amqp_tcp_socket_new(connection);

    if (!socket)
    {
        std::cerr << "Failed to create RabbitMQ socket\n";
        return;
    }

    // Connect to RabbitMQ
    int status =
        amqp_socket_open(socket, host, port);

    if (status != AMQP_STATUS_OK)
    {
        std::cerr << "Failed to connect to RabbitMQ\n";
        amqp_destroy_connection(connection);
        return;
    }

    // Login
    amqp_rpc_reply_t loginReply =
        amqp_login(
            connection,
            "/",
            0,
            131072,
            0,
            AMQP_SASL_METHOD_PLAIN,
            "guest",
            "guest"
        );

    if (loginReply.reply_type != AMQP_RESPONSE_NORMAL)
    {
        std::cerr << "RabbitMQ login failed\n";
        amqp_connection_close(connection, AMQP_REPLY_SUCCESS);
        amqp_destroy_connection(connection);
        return;
    }

    // Open channel
    amqp_channel_open(connection, 1);
    if (amqp_get_rpc_reply(connection).reply_type != AMQP_RESPONSE_NORMAL)
    {
        std::cerr << "Failed to open RabbitMQ channel\n";
        amqp_connection_close(connection, AMQP_REPLY_SUCCESS);
        amqp_destroy_connection(connection);
        return;
    }

    // Declare the input queue (deploy.events)
    amqp_queue_declare(
        connection,
        1,
        amqp_cstring_bytes(queueName.c_str()),
        0,  // passive
        1,  // durable
        0,  // exclusive
        0,  // auto-delete
        amqp_empty_table
    );

    if (amqp_get_rpc_reply(connection).reply_type != AMQP_RESPONSE_NORMAL)
    {
        std::cerr << "Failed to declare queue\n";
        amqp_connection_close(connection, AMQP_REPLY_SUCCESS);
        amqp_destroy_connection(connection);
        return;
    }

    // Declare the output queue (deployment.results).
    // Same flags as the backend, so it exists whichever side starts first.
    amqp_queue_declare(
        connection,
        1,
        amqp_cstring_bytes(RESULTS_QUEUE),
        0,  // passive
        1,  // durable
        0,  // exclusive
        0,  // auto-delete
        amqp_empty_table
    );

    if (amqp_get_rpc_reply(connection).reply_type != AMQP_RESPONSE_NORMAL)
    {
        std::cerr << "Failed to declare results queue\n";
        amqp_connection_close(connection, AMQP_REPLY_SUCCESS);
        amqp_destroy_connection(connection);
        return;
    }

    // Take one unacknowledged message at a time.
    amqp_basic_qos(connection, 1, 0, 1, 0);

    // Start consuming (manual acks: no_ack = 0)
    amqp_basic_consume(
        connection,
        1,
        amqp_cstring_bytes(queueName.c_str()),
        amqp_empty_bytes,
        0,  // no_local
        0,  // no_ack  <-- was 1, we now ack ourselves
        0,  // exclusive
        amqp_empty_table
    );

    if (amqp_get_rpc_reply(connection).reply_type != AMQP_RESPONSE_NORMAL)
    {
        std::cerr << "Failed to start consuming\n";
        amqp_connection_close(connection, AMQP_REPLY_SUCCESS);
        amqp_destroy_connection(connection);
        return;
    }

    std::cout<< "Waiting for messages on queue: "<< queueName<< '\n';

    while (true)
    {
        amqp_envelope_t envelope;

        amqp_maybe_release_buffers(connection);

        amqp_rpc_reply_t result =
            amqp_consume_message(
                connection,
                &envelope,
                nullptr,
                0
            );

        if (result.reply_type != AMQP_RESPONSE_NORMAL)
        {
            std::cerr << "Error receiving message\n";
            break;
        }

        std::string message(
            static_cast<char*>(envelope.message.body.bytes),
            envelope.message.body.len
        );
        std::cout << "Received: "<< message<< '\n';

        // Stays empty if the message is malformed (we then don't know the app id).
        std::optional<DeployEvent> event;

        try
        {
            event = parseMessage(message);
            std::cout << "\n=== Deployment Event ===\nID:" << event->id << "\n";

            handleDeploy(connection, *event);
        }
        catch (const std::exception& e)
        {
            std::cerr << "Failed to process message: "<< e.what()<< "\n";

            // Only report if parsing succeeded, otherwise there is no id.
            if (event)
            {
                publishResult(connection, *event, false, "processing", e.what());
            }
        }

        // Ack AFTER the result was published: a crash before this line
        // makes RabbitMQ redeliver instead of losing the deployment.
        amqp_basic_ack(connection, 1, envelope.delivery_tag, 0);
        amqp_destroy_envelope(&envelope);
    }

    amqp_channel_close(
        connection,
        1,
        AMQP_REPLY_SUCCESS
    );

    amqp_connection_close(
        connection,
        AMQP_REPLY_SUCCESS
    );

    amqp_destroy_connection(connection);
}

DeployEvent Queue::parseMessage(const std::string& message)
{
    nlohmann::json jsonMessage =
        nlohmann::json::parse(message);

    std::string eventType =
        jsonMessage.at("event");

    if (eventType != "deploy")
    {
        throw std::runtime_error(
            "Unsupported event type: " + eventType
        );
    }

    return DeployEvent::fromJson(
        jsonMessage.at("data")
    );
}

// The deployment pipeline. Every step reports to the backend:
//   cloned -> built -> pushed   (progress, status "deploying")
//   any failure                 (failed, with the stage that broke)
void Queue::handleDeploy(amqp_connection_state_t connection,
                         const DeployEvent& event)
{
    // ---- Step 1: clone ----
    if (!RepositoryManager::cloneRepository(event))
    {
        std::cerr << "Repository preparation failed.\n";
        publishResult(connection, event, false, "clone",
                      "Could not clone repository");
        return;
    }

    std::cout << "Application repository is cloned.\n";
    publishProgress(connection, event, "cloned");

    const auto repoPath = RepositoryManager::getRepositoryPath(event);

    // ---- Step 2: validate (exactly one Dockerfile) ----
    std::filesystem::path dockerfilePath;
    std::string error;

    if (!RepositoryManager::validateRepository(repoPath, dockerfilePath, error))
    {
        std::cerr << "Validation failed: " << error << '\n';

        // Remove the clone so the user can fix the repo and redeploy.
        RepositoryManager::removeRepository(repoPath);

        publishResult(connection, event, false, "validation", error);
        return;
    }

    // ---- Config check ----
    const char* hubUser  = std::getenv("DOCKERHUB_USERNAME");
    const char* hubToken = std::getenv("DOCKERHUB_TOKEN");
    const char* hubRepo  = std::getenv("DOCKERHUB_REPOSITORY");

    std::string missing;
    if (!hubUser)  missing += " DOCKERHUB_USERNAME";
    if (!hubToken) missing += " DOCKERHUB_TOKEN";
    if (!hubRepo)  missing += " DOCKERHUB_REPOSITORY";

    if (!missing.empty())
    {
        RepositoryManager::removeRepository(repoPath);
        publishResult(connection, event, false, "config",
                      "Missing environment variables on the core:" + missing);
        return;
    }

    // ---- Step 3: build ----
    const std::string imageName = DockerManager::getImageName(event, hubRepo);
    const bool built = DockerManager::buildImage(dockerfilePath, imageName, error);

    // The repo is no longer needed once the build is done.
    // Deleted on failure too, so a retry doesn't hit "already exists".
    RepositoryManager::removeRepository(repoPath);

    if (!built)
    {
        publishResult(connection, event, false, "build", error);
        return;
    }

    publishProgress(connection, event, "built");



        // The app's port comes from the image's EXPOSE. Checked before pushing.
    int port = 0;

    if (!DockerManager::getExposedPort(imageName, port, error))
    {
        publishResult(connection, event, false, "validation", error);
        return;
    }

    // ---- Step 4: login + push ----
    if (!DockerManager::login(hubUser, hubToken, error) ||
        !DockerManager::pushImage(imageName, error))
    {
        publishResult(connection, event, false, "push", error);
        return;
    }

    std::cout << "Image available on Docker Hub: " << imageName << '\n';
    publishProgress(connection, event, "pushed", imageName);

    // ---- Step 5: deploy on Kubernetes ----
    if (!K8sManager::apply(event, imageName, port, error))
    {
        publishResult(connection, event, false, "k8s-apply", error, imageName);
        return;
    }

    publishProgress(connection, event, "k8s-applied", imageName);

    if (!K8sManager::waitForRollout(event, error))
    {
        publishResult(connection, event, false, "k8s-rollout", error, imageName);
        return;
    }

        std::string url;

    if (!K8sManager::getUrl(event, url, error))
    {
        publishResult(connection, event, false, "k8s-url", error, imageName);
        return;
    }

    std::cout << "Application is live: " << url << '\n';

    publishResult(connection, event, true, "deployed", "", imageName, url);


}

// Intermediate step reached. The deployment is still in progress.
void Queue::publishProgress(
    amqp_connection_state_t connection,
    const DeployEvent& event,
    const std::string& stage,
    const std::string& image)
{
    nlohmann::json data = {
        {"applicationId", event.id},
        {"status", "deploying"},
        {"stage", stage}
    };

    if (!image.empty()) data["image"] = image;

    nlohmann::json message = {
        {"event", "deployment.progress"},
        {"data", data}
    };

    publishMessage(connection, message);
}

// Final outcome of the deployment.
// Note: no default arguments here, they live in queue.hpp.
void Queue::publishResult(
    amqp_connection_state_t connection,
    const DeployEvent& event,
    bool success,
    const std::string& stage,
    const std::string& error,
    const std::string& image,
    const std::string& url)
{
    // Must match what the Node consumer validates.
    nlohmann::json data = {
        {"applicationId", event.id},
        {"status", success ? "deployed" : "failed"}
    };

    if (!stage.empty()) data["stage"] = stage;
    if (!error.empty()) data["error"] = error;
    if (!image.empty()) data["image"] = image;
    if (!url.empty())   data["url"]   = url; 

    nlohmann::json message = {
        {"event", success ? "deployment.succeeded" : "deployment.failed"},
        {"data", data}
    };

    publishMessage(connection, message);
}

// The only place that publishes to "deployment.results".
void Queue::publishMessage(amqp_connection_state_t connection,
                           const nlohmann::json& message)
{
    // 'replace' avoids a throw if the text has invalid UTF-8.
    const std::string payload = message.dump(
        -1, ' ', false, nlohmann::json::error_handler_t::replace);

    amqp_basic_properties_t props;
    props._flags = AMQP_BASIC_CONTENT_TYPE_FLAG | AMQP_BASIC_DELIVERY_MODE_FLAG;
    props.content_type = amqp_cstring_bytes("application/json");
    props.delivery_mode = 2; // persistent, survives a broker restart

    amqp_bytes_t body;
    body.len = payload.size();
    body.bytes = const_cast<char*>(payload.data());

    // Default exchange ("") routes by queue name.
    int status = amqp_basic_publish(
        connection,
        1,                                  // same channel we consume on
        amqp_cstring_bytes(""),
        amqp_cstring_bytes(RESULTS_QUEUE),
        0,                                  // mandatory
        0,                                  // immediate
        &props,
        body
    );

    if (status != AMQP_STATUS_OK)
    {
        std::cerr << "Failed to publish message: "
                  << amqp_error_string2(status) << '\n';
        return;
    }

    std::cout << "Published: " << payload << '\n';
}