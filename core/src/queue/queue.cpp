#include "queue.hpp"

#include <iostream>

#include <amqp.h>
#include <amqp_tcp_socket.h>

Queue::Queue(const std::string& queueName)
    : queueName(queueName)
{
}

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

    std::cout
        << "Waiting for messages on queue: "
        << queueName
        << '\n';

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

        std::cout
            << "Received: "
            << message
            << '\n';

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