import { Router } from "express";
import {
    createApp,
    deleteApp,
    getApp,
    listApps,
    updateApp
} from "../controllers/appController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", listApps);
router.post("/", createApp);
router.get("/:id", getApp);
router.patch("/:id", updateApp);
router.put("/:id", updateApp);
router.delete("/:id", deleteApp);

export default router;
