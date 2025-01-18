import express from "express";
import { signup, login, deleteAccount } from "../controllers/authController.js";
import { verifyToken } from "../middleware/jwtMiddleware.js";  

const router = express.Router();

router.post("/signup", signup);

router.post("/login", login);

router.delete("/deleteAccount", verifyToken, deleteAccount);
export default router;
