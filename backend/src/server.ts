import "dotenv/config";
import app from "./app.js";
import prisma, { initializeDatabase } from "./db/database.js";
import { connectRabbitMQ, onRabbitMQConnected } from "./queue/queue.js";
import { deploymentMessage, startDeploymentResultsConsumer } from "./queue/consumer.js";
import { publishDeploymentUpdate } from "./events/deploymentEvents.js";
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`backend running on port ${PORT}`);

    initializeDatabase().catch((error: unknown) => {
        console.error("Failed to connect to PostgreSQL", error);
        server.close(() => process.exit(1));
    });

    onRabbitMQConnected(() =>
    startDeploymentResultsConsumer(async (result) => {
        // Core status "deployed" maps to the UI's stable "running" state.
        const updatedApp = await prisma.application.update({
            where: { id: result.applicationId },
            include: { environmentVariables: true },
            data: {
                status: result.status === "deployed" ? "running" : result.status,
                isDeployed: result.status === "deployed",
                deploymentStage: result.stage ?? null,
                deploymentMessage: deploymentMessage(result.stage, result.status),
                deploymentImage: result.image ?? undefined,
                deploymentError: result.error ?? null,
                deploymentUrl: result.url ?? undefined,
            },
        });
        publishDeploymentUpdate(result.applicationId, updatedApp);
    })
);
    connectRabbitMQ();

});