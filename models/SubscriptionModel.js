import { model, Schema } from "mongoose";


const SubscriptionSchema = new Schema({
  razorpaySubscriptionId: {
    type: String,
    required: true,
    unique: true,
  },
  shortUrl:{
    type: String,
  },

  planId: {
    type: String,
    required: true,
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  status: {
    type: String,
    default: "created",
  }, 
},
{ timestamps: true }
);

const Subscription = model("Subscription", SubscriptionSchema);
export default Subscription;
