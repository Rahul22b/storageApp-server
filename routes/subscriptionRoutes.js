import express from "express";
import bodyParser from "body-parser";
const router = express.Router();
import checkAuth from "../middlewares/authMiddleware.js";
import { createSubscription, handleWebhook } from "../controllers/subscriptionController.js";

router.post("/create-subscription", checkAuth, createSubscription);
router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  handleWebhook
);

export default router;
