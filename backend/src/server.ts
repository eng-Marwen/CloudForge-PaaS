import "dotenv/config";
import app from "./app.js";
import { initializeDatabase } from "./db/database.js";
import { connectRabbitMQ, onRabbitMQConnected } from "./queue/queue.js";
import { startDeploymentResultsConsumer } from "./queue/consumer.js";
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`backend running on port ${PORT}`);

    initializeDatabase().catch((error: unknown) => {
        console.error("Failed to connect to PostgreSQL", error);
        server.close(() => process.exit(1));
    });

    onRabbitMQConnected(() =>
    startDeploymentResultsConsumer(async (result) => {
        // Replace with your real DB update, e.g.:
        // await db.query(
        //   "UPDATE applications SET status = $1, stage = $2, error = $3 WHERE id = $4",
        //   [result.status, result.stage, result.error, result.applicationId]
        // );
    })
);
    connectRabbitMQ();

});