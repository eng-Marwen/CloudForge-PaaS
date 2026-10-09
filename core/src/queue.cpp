#include "queue.hpp"
#include "repositoryManager.hpp"

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

            // Step 2: Prepare the repository.
            if (RepositoryManager::cloneRepository(*event))
                {
                    std::cout << "Application repository is cloned.\n";

                    // Step 3: validate (exactly one Dockerfile).
                    const auto repoPath = RepositoryManager::getRepositoryPath(*event);
                    std::filesystem::path dockerfilePath;
                    std::string validationError;

                    if (!RepositoryManager::validateRepository(
                            repoPath, dockerfilePath, validationError))
                    {
                        std::cerr << "Validation failed: " << validationError << '\n';

                        // Remove the clone so the user can fix the repo and redeploy.
                        RepositoryManager::removeRepository(repoPath);

                        publishResult(connection, *event, false, "validation",
                                    validationError);
                    }
                    else
                    {
                        std::cout << "Dockerfile found: " << dockerfilePath << '\n';

                        // TEMPORARY: move this after the last step once Docker build/run exist.
                        publishResult(connection, *event, true, "validation");

                        // Next: docker build using dockerfilePath.parent_path() as context.
                    }
                }
            else
            {
                std::cerr << "Repository preparation failed.\n";
                publishResult(connection, *event, false, "clone",
                            "Could not clone repository");
            }

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

// The producer: publishes the outcome to "deployment.results".
// Note: no default arguments here, they live in queue.hpp.
void Queue::publishResult(
    amqp_connection_state_t connection,
    const DeployEvent& event,
    bool success,
    const std::string& stage,
    const std::string& error)
{
    // Must match what the Node consumer validates.
    nlohmann::json data = {
        {"applicationId", event.id},
        {"status", success ? "deployed" : "failed"}
    };

    if (!stage.empty()) data["stage"] = stage;
    if (!error.empty()) data["error"] = error;

    nlohmann::json message = {
        {"event", success ? "deployment.succeeded" : "deployment.failed"},
        {"data", data}
    };

    // 'replace' avoids a throw if the error text has invalid UTF-8.
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
        std::cerr << "Failed to publish deployment result: "
                  << amqp_error_string2(status) << '\n';
        return;
    }

    std::cout << "Published result: " << payload << '\n';
}