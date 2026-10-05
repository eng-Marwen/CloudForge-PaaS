import "dotenv/config";
import app from "./app.js";
import { initializeDatabase } from "./db/database.js";
import{connectRabbitMQ} from "./queue/queue.js"

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`backend running on port ${PORT}`);

    initializeDatabase().catch((error: unknown) => {
        console.error("Failed to connect to PostgreSQL", error);
        server.close(() => process.exit(1));
    });
    connectRabbitMQ();

});