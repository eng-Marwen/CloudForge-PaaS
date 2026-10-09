#include "queue.hpp"
#include "repositoryManager.hpp"

#include <iostream>
#include <amqp.h>
#include <amqp_tcp_socket.h>
#include <stdexcept>
#include <nlohmann/json.hpp>

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

    // Declare queue
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

    // Start consuming
    amqp_basic_consume(
        connection,
        1,
        amqp_cstring_bytes(queueName.c_str()),
        amqp_empty_bytes,
        0,
        1,
        0,
        amqp_empty_table
    );

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
        try
            {
                DeployEvent event = parseMessage(message);
                std::cout << "\n=== Deployment Event ===\nID:"<<event.id<<"\n";


                    // Step 2: Prepare the repository.
                if (RepositoryManager::cloneRepository(event))
                {
                    std::cout << "Application repository is ready.\n";

                    // Next: build the Docker image.
                }
                else
                {
                    std::cerr << "Repository preparation failed.\n";

                    // Next: report deployment failure to the backend.
                }


            }
            catch (const std::exception& e)
            {
                std::cerr << "Failed to process message: "<< e.what()<< "\n";        
            }
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
