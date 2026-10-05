import { getChannel } from "./queue.js";

const QUEUE_NAME = "deploy.events";

export const publishDeployEvent = async (data: any) => {
    const channel = getChannel();

    await channel.assertQueue(QUEUE_NAME, {
        durable: true,
    });

    const message = {
        event: "deploy",
        data,
    };

    const payload = Buffer.from(JSON.stringify(message));

    console.log("[RabbitMQ] Sending deploy event", {
        queue: QUEUE_NAME,
        bytes: payload.length,
    });

    const acceptedByBuffer = channel.sendToQueue(
        QUEUE_NAME,
        payload,
        {
            persistent: true,
        }
    );

    console.log("[RabbitMQ] Deploy event sent", {
        queue: QUEUE_NAME,
        acceptedByBuffer,
    });
};