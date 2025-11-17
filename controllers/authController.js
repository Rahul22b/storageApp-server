import mongoose, { Types } from "mongoose";
import crypto from 'crypto';
import User from "../models/userModel.js";
import Directory from "../models/directoryModel.js";
import { verifyIdToken } from "../services/googleAuthService.js";
import { sendOtpService } from "../services/sendOtpService.js";
import redisClient from "../config/redis.js";
import { otpSchema } from "../validators/authSchema.js";

export const sendOtp = async (req, res, next) => {
  const { email } = req.body;
  
  const existingUser = await User.findOne({ email: email }).select('email');

  // *CORRECTED LOGIC*: Check if the email *ALREADY EXISTS* in the database.
  if (existingUser) {
    // If a user is found (i.e., email already exists), return an error.
    return res.status(409).json({ error: "Email already registered. Please log in." });
    // Use status 409 (Conflict) as it's more appropriate than a generic 400 or 500.
  }
  const resData = await sendOtpService(email);
  res.status(201).json(resData);
};

 // Ensure you import crypto if you're using Node.js

export const verifyOtp = async (req, res, next) => {
  const { success, data } = otpSchema.safeParse(req.body);

  if (!success) {
    return res.status(400).json({ error: "Invalid input data for OTP verification." });
  }

  const { email, otp } = data;
  const key = `otp:${email}`;
  const TokenExpiryTimeMs = 5 * 60 * 1000; // 5 minutes in milliseconds
  const TokenExpiryTimeSec = 5 * 60;        // 5 minutes in seconds (for Redis)

  try {
    // 1. Retrieve the JSON string from Redis
    const otpRecordString = await redisClient.json.get(key);
    
    // Check 1: Key Existence (Handles Expiration)
    if (!otpRecordString) {
      return res.status(400).json({ error: "Invalid or Expired OTP!" });
    }

    // 2. Parse the stored JSON object
    // const otpRecord = JSON.parse(otpRecordString);

    // Check 2: OTP Match
    if (otpRecordString.otp !== otp) {
      // It is good practice to delete the OTP after an incorrect attempt, 
      // but for simplicity, we'll leave it to expire or be deleted on success.
      return res.status(400).json({ error: "Invalid OTP!" });
    }

    // --- Success: Generate Verification Proof ---
    
    // 3. Generate a unique, random verification ID
    const verificationId = crypto.randomUUID(); 
    
    // 4. Store the verification ID (key) with the user's email (value) in Redis
    // Key: verify_id:<uuid> | Value: <email>
    const verificationKey = `verify_id:${verificationId}`;

    // *CORRECTION*: Use SET command with EX option for simple key-value storage and TTL.
    await redisClient.set(verificationKey, email, {
      EX: TokenExpiryTimeSec // Set the expiration time in SECONDS
    });

    // 5. Delete the used OTP key from Redis (Crucial for one-time use)
    await redisClient.del(key); 

    // 6. Set the unique ID as a Signed, HTTP-Only Cookie
    res.cookie('verification_proof', verificationId, {
      httpOnly: true,
      signed: true,
      secure:true, 
      sameSite: "none",
      maxAge: TokenExpiryTimeMs, // MaxAge must be in MILLISECONDS for cookies
    });
    

    return res.json({ message: "OTP Verified! Proceed to registration." });

  } catch (error) {
    console.error("Redis verification error:", error);
    // Be sure to handle potential JSON parsing errors here too
    return res.status(500).json({ error: "Server error during verification." });
  }
};

export const loginWithGoogle = async (req, res, next) => {
  const { idToken } = req.body;
  const userData = await verifyIdToken(idToken);
  const { name, email, picture } = userData;
  const user = await User.findOne({ email }).select("-__v");
  if (user) {
    if (user.deleted) {
      return res.status(403).json({
        error: "Your account has been deleted. Contact app owner to recover.",
      });
    }

    const allSessions = await redisClient.ft.search(
      "userIdIdx",
      `@userId:{${user.id}}`,
      {
        RETURN: [],
      }
    );

    if (allSessions.total >= 2) {
      await redisClient.del(allSessions.documents[0].id);
    }

    if (!user.picture.includes("googleusercontent.com")) {
      user.picture = picture;
      await user.save();
    }

    const sessionId = crypto.randomUUID();
    const redisKey = `session:${sessionId}`;
    await redisClient.json.set(redisKey, "$", {
      userId: user._id,
      rootDirId: user.rootDirId,
    });

    const sessionExpiryTime = 60 * 1000 * 60 * 24 * 7;
    await redisClient.expire(redisKey, sessionExpiryTime / 1000);

    res.cookie("sid", sessionId, {
      httpOnly: true,
      signed: true,
      maxAge: sessionExpiryTime,
      sameSite: "none",
      secure: true,
    });
    return res.json({ message: "logged in" });
  }

  const mongooseSession = await mongoose.startSession();

  try {
    const rootDirId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    mongooseSession.startTransaction();

    await Directory.insertOne(
      {
        _id: rootDirId,
        name: `root-${email}`,
        parentDirId: null,
        userId,
      },
      { mongooseSession }
    );

    await User.insertOne(
      {
        _id: userId,
        name,
        email,
        picture,
        rootDirId,
      },
      { mongooseSession }
    );

    const sessionId = crypto.randomUUID();
    const redisKey = `session:${sessionId}`;
    await redisClient.json.set(redisKey, "$", {
      userId: userId,
      rootDirId: rootDirId,
    });

    const sessionExpiryTime = 60 * 1000 * 60 * 24 * 7;
    await redisClient.expire(redisKey, sessionExpiryTime / 1000);

    res.cookie("sid", sessionId, {
      httpOnly: true,
      signed: true,
      maxAge: sessionExpiryTime,
      sameSite: "none",
      secure: true,

    });

    mongooseSession.commitTransaction();
    res.status(201).json({ message: "account created and logged in" });
  } catch (err) {
    mongooseSession.abortTransaction();
    next(err);
  }
};
