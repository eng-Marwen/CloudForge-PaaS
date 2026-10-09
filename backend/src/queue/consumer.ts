import type { ConsumeMessage } from "amqplib";
import { getChannel } from "./queue.js";

const QUEUE_NAME = "deployment.results";

export interface DeploymentResult {
    applicationId: number;
    status: "deployed" | "failed";
    stage?: string;
    error?: string;
}

interface DeploymentResultMessage {
    event: "deployment.succeeded" | "deployment.failed";
    data: DeploymentResult;
}

// Thrown for bad messages: retrying would never fix them.
class InvalidMessageError extends Error {}

const parseMessage = (message: ConsumeMessage): DeploymentResult => {
    let payload: DeploymentResultMessage;

    try {
        payload = JSON.parse(message.content.toString());
    } catch {
        throw new InvalidMessageError("Message is not valid JSON");
    }

    if (
        payload?.event !== "deployment.succeeded" &&
        payload?.event !== "deployment.failed"
    ) {
        throw new InvalidMessageError(`Unsupported event: ${payload?.event}`);
    }

    const result = payload.data;

    if (!result || !Number.isInteger(result.applicationId) || result.applicationId <= 0) {
        throw new InvalidMessageError("Invalid applicationId");
    }

    if (result.status !== "deployed" && result.status !== "failed") {
        throw new InvalidMessageError(`Invalid status: ${result.status}`);
    }

    return result;
};

export const startDeploymentResultsConsumer = async (
    updateDeployment: (result: DeploymentResult) => Promise<void>
) => {
    const channel = getChannel();

    await channel.assertQueue(QUEUE_NAME, { durable: true });
    await channel.prefetch(1);

    await channel.consume(QUEUE_NAME, async (message) => {
        if (!message) {
            console.warn("[RabbitMQ] Deployment results consumer was cancelled");
            return;
        }

        try {
            const result = parseMessage(message);

            // Persist BEFORE acking so a crash doesn't lose the result.
            await updateDeployment(result);

            console.log("[RabbitMQ] Deployment result processed", result);
            channel.ack(message);
        } catch (error) {
            if (error instanceof InvalidMessageError) {
                // Malformed: drop (or dead-letter) it, retrying won't help.
                console.error("[RabbitMQ] Invalid deployment result:", error.message);
                channel.nack(message, false, false);
            } else {
                // Likely a transient DB error: put it back on the queue.
                console.error("[RabbitMQ] Failed to save deployment result:", error);
                channel.nack(message, false, true);
            }
        }
    });

    console.log(`[RabbitMQ] Listening for deployment results on "${QUEUE_NAME}"`);
};