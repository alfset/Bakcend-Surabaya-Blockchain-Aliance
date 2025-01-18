// routes/authRoutes.js
import express from "express";
import { signup, login } from "../controllers/authController.js";

const router = express.Router();

// Signup Route (with wallet address and optional password)
router.post("/signup", signup);

// Login Route (with wallet address and optional password)
router.post("/login", login);

export default router;
