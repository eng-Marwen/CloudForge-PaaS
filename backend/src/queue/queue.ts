import amqp, { Channel } from "amqplib";

let channel: Channel | undefined;
const RABBITMQ_RETRY_MS = 5000;
const onConnectedHandlers: Array<() => Promise<void>> = [];

// Register things that must be re-created on every (re)connect.
export const onRabbitMQConnected = (handler: () => Promise<void>) => {
  onConnectedHandlers.push(handler);
};

export const connectRabbitMQ = async () => {
  const url = process.env.RABBITMQ_URL;

  try {
    const connection = await amqp.connect(url as string);
    channel = await connection.createChannel();

    channel.on("error", (error) => {
      console.error("RabbitMQ channel error:", error);
    });

    connection.on("error", (error) => {
      console.error("RabbitMQ connection error:", error);
    });

    connection.on("close", () => {
      channel = undefined;
      console.error("RabbitMQ connection closed. Reconnecting...");
      setTimeout(() => {
        connectRabbitMQ().catch((e) =>
          console.error("RabbitMQ reconnect attempt failed:", e)
        );
      }, RABBITMQ_RETRY_MS);
    });

    console.log("connected to rabbitMQ");

    for (const handler of onConnectedHandlers) {
      await handler();
    }
  } catch (error) {
    console.error("RabbitMQ connection error:", error);
    setTimeout(() => {
      connectRabbitMQ().catch((e) =>
        console.error("RabbitMQ reconnect attempt failed:", e)
      );
    }, RABBITMQ_RETRY_MS);
  }
};

export const getChannel = () => {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized");
  }
  return channel;
};