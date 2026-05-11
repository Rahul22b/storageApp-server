
import razorpay from "razorpay";
import Subscription from "../models/SubscriptionModel.js";
import User from "../models/userModel.js";
const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});



const plans=[
  {
    planId:"plan_RVdCjWaMZVL9p0",
    storage:5*1024*1024*1024
  },
  {
    planId:"plan_RVdHgBN35v0Be2",
    storage:5*1024*1024*1024
  },
  {
    planId:"plan_RVdGn5zJfynknl",
    storage:10*1024*1024*1024},
  {
    planId:"plan_RVdHCnq9b7KDwf",
    storage:10*1024*1024*1024
  },
];


export const createSubscription = async (req, res, next) => {
  try {
  const { planId } = req.body;
        console.log("user", req.user._id);
        

      const existingSubscription = await Subscription.findOne({ userId: req.user._id, planId: planId });

    if (existingSubscription) {
      console.log("existed url");
      console.log(existingSubscription);
      return res.status(200).json({ shortUrl: existingSubscription.shortUrl });
    }

    const subscription = await razorpayInstance.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 12,
    });

    const newSubscription = new Subscription({
      razorpaySubscriptionId: subscription.id,
      planId: planId,
      userId: req.user._id,
      "shortUrl": subscription.short_url,
    });
    await newSubscription.save();
    res.json({ shortUrl: subscription.short_url });
  } catch (err) {
    next(err);
  }
}

export const handleWebhook = async (req, res, next) => {
  console.log("webhook triggered");
  try {
    const rawBody =
      req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body);
    const body =
      req.body instanceof Buffer ? JSON.parse(req.body.toString("utf8")) : req.body;
    const subscriptionId = body.payload.subscription.entity.id;
    const isValid = razorpay.validateWebhookSignature(
      rawBody,
      req.headers["x-razorpay-signature"],
      process.env.WEBHOOK_SECRET
    );



    if (!isValid) {
      return res.status(400).json({ error: "Invalid signature" });
    }



    const subscription = await Subscription.findOne({ razorpaySubscriptionId: subscriptionId });
    console.log("subscription",subscription);
    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    if (
      body.event === "subscription.activated" ||
      body.event === "subscription.reactivated" ||
      body.event === "subscription.resumed"
    ) {
      console.log("subscription activated");
      subscription.status = "active";
      await subscription.save();
      const user = await User.findById(subscription.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const plan = plans.find((plan) => plan.planId === subscription.planId);
      if (!plan) {
        return res.status(400).json({ error: "Unknown subscription plan" });
      }
      user.maxStorageInBytes += plan.storage;
      await user.save();
      return res.json({ message: "Subscription activated successfully" });
    }
    if (
      body.event === "subscription.cancelled" ||
      body.event === "subscription.expired" ||
      body.event === "subscription.completed" ||
      body.event === "subscription.halted" ||
      body.event === "subscription.paused"
    ) {
      subscription.status = body.event;
      await subscription.save();
      const user = await User.findById(subscription.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const plan = plans.find((plan) => plan.planId === subscription.planId);
      if (!plan) {
        return res.status(400).json({ error: "Unknown subscription plan" });
      }
      user.maxStorageInBytes -= plan.storage;
      await user.save();
      return res.json({ message: "Subscription cancelled successfully" });
    }

    res.json({ message: "Subscription verified successfully" });
  } catch (err) {
    next(err);
  }
};

