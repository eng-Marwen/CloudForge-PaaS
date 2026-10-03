import { Router } from "express";
import { deleteAccount, getCurrentUser, login, logout, register, updateProfile } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", requireAuth, getCurrentUser);
router.patch("/profile", requireAuth, updateProfile);
router.delete("/delete", requireAuth, deleteAccount);

export default router;