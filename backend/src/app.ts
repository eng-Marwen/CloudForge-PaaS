import cors from "cors";
import express from "express";
import morgan from "morgan";
import appRouter from "./routes/appRoute.js";
import authRouter from "./routes/authRoute.js";

const app = express();

app.use(cors({ credentials: true }));
app.use(express.json());
app.use(morgan("dev"));
app.use("/api/auth", authRouter);
app.use("/api/apps", appRouter);

app.get("/api/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "cloudforge-backend"
    });
});

export default app;