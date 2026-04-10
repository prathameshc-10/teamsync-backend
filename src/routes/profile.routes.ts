import { Router } from "express";
import { verifyAccessToken } from "../middleware/auth.middleware";
import * as ProfileController from "../controllers/profile.controller";

const router = Router();

// All profile routes are protected — require valid JWT
router.use(verifyAccessToken);

// GET  /api/profile          — fetch full profile + organizations
router.get("/", ProfileController.getProfile);

// PATCH /api/profile         — update fullName / email
router.patch("/", ProfileController.updateProfile);

// PATCH /api/profile/password — change password
router.patch("/password", ProfileController.changePassword);

export default router;