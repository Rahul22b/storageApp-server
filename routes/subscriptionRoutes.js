import express from "express";
const router = express.Router();
import checkAuth from "../middlewares/authMiddleware.js";
import { createSubscription, handleWebhook } from "../controllers/subscriptionController.js";

router.post("/create-subscription", checkAuth, createSubscription);
router.post("/webhook", handleWebhook);

export default router;
