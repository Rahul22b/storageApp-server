import Directory from "../models/directoryModel.js";
import User from "../models/userModel.js";
import mongoose, { Types } from "mongoose";
import redisClient from "../config/redis.js";
import { z } from "zod/v4";
import crypto from "crypto";
import { loginSchema, registerSchema } from "../validators/authSchema.js";

const extractRedisField = (doc, field) => {
  if (!doc) return undefined;
  if (doc.value && Object.prototype.hasOwnProperty.call(doc.value, field)) {
    return doc.value[field];
  }
  if (Object.prototype.hasOwnProperty.call(doc, field)) {
    return doc[field];
  }
  return undefined;
};

const deleteSessionsByUserId = async (userId) => {
  const allSessions = await redisClient.ft.search(
    "userIdIdx",
    `@userId:{${userId}}`,
    {
      RETURN: [],
    }
  );

  const keysToDelete = allSessions.documents.map(({ id }) => id);
  if (keysToDelete.length > 0) {
    await redisClient.del(keysToDelete);
  }
};

const getLoggedInUserIds = async () => {
  const allSessions = await redisClient.ft.search(
    "userIdIdx",
    `@userId:{*}`,
    {
      RETURN: ["userId"],
    }
  );

  return allSessions.documents
    .map((doc) => extractRedisField(doc, "userId"))
    .filter(Boolean)
    .map((id) => id.toString());
};

export const register = async (req, res, next) => {
  const { success, data, error } = registerSchema.safeParse(req.body);

   if (!success) {
    return res.status(400).json({ error: z.flattenError(error).fieldErrors.name });
  }

   try{
     const d=await redisClient.json.get(`otp:${data.email}`); //object
    if(!d){
      return res.status(400).json({error:"OTP expired or not found"});
    }
    const  storedOtp  = d.otp;

    if(storedOtp!==data.otp){
      return res.status(400).json({error:"Invalid OTP"});
    }

   }
   catch(err){
     console.error("Error fetching OTP from Redis:", err);
     next(err);
     return;
   }
  const { name, email, password} = data;

  const session = await mongoose.startSession();

  try {    
    const rootDirId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    session.startTransaction();

    await Directory.insertOne(
      {
        _id: rootDirId,
        name: `root-${email}`,
        parentDirId: null,
        userId,
      },
      { session }
    );

    await User.insertOne(
      {
        _id: userId,
        name,
        email,
        password,
        rootDirId,
      },
      { session }
    );

    session.commitTransaction();

    res.status(201).json({ message: "User Registered" });
  } catch (err) {
    session.abortTransaction();
    console.log(err);
    if (err.code === 121) {
      res
        .status(400)
        .json({ error: "Invalid input, please enter valid details" });
    } else if (err.code === 11000) {
      if (err.keyValue.email) {
        return res.status(409).json({
          error: "This email already exists",
          message:
            "A user with this email address already exists. Please try logging in or use a different email.",
        });
      }
    } else {
      next(err);
    }
  }
};

export const login = async (req, res, next) => {
  const { success, data } = loginSchema.safeParse(req.body);

  if (!success) {
    return res.status(400).json({ error: "Invalid Credentials" });
  }

  const { email, password } = data;
  const user = await User.findOne({ email });

  if (!user || user.deleted) {
    return res.status(404).json({ error: "Invalid Credentials" });
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    return res.status(404).json({ error: "Invalid Credentials" });
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
    secure: true,
    sameSite: "none",
    maxAge: sessionExpiryTime,
  });
  res.json({ message: "logged in" });
};

export const getAllUsers = async (req, res) => {
  const allUsers = await User.find({ deleted: false }).lean();
  const loggedInUserIds = new Set(await getLoggedInUserIds());

  const transformedUsers = allUsers.map(({ _id, name, email }) => ({
    id: _id,
    name,
    email,
    isLoggedIn: loggedInUserIds.has(_id.toString()),
  }));
  res.status(200).json(transformedUsers);
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const rootDir = user.rootDirId
      ? await Directory.findById(user.rootDirId).lean()
      : null;

    return res.status(200).json({
      name: user.name,
      email: user.email,
      picture: user.picture,
      role: user.role,
      maxStorageInBytes: user.maxStorageInBytes,
      usedStorageInBytes: rootDir?.size ?? 0,
    });
  } catch (err) {
    console.error("Error in getCurrentUser:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const logout = async (req, res) => {
  const { sid } = req.signedCookies;
  await redisClient.del(`session:${sid}`);
  res.clearCookie("sid");
  res.status(204).end();
};

export const logoutById = async (req, res, next) => {
  try {
    await deleteSessionsByUserId(req.params.userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const logoutAll = async (req, res) => {
  const { sid } = req.signedCookies;
  
  // 1. Attempt to retrieve the session
  const session = await redisClient.json.get(`session:${sid}`);

  // 2. CHECK FOR NULL/UNDEFINED SESSION 🛑
  if (!session || !session.userId) {
    return res.clearCookie("sid").status(204).end();
  }

  // 3. Proceed with search and deletion only if userId is valid
  const allSessions = await redisClient.ft.search(
    "userIdIdx",
    `@userId:{${session.userId}}`,
    {
      RETURN: ["__$key"],
    }
  );

  const keysToDelete = allSessions.documents.map(({ id }) => id);

  if (keysToDelete.length > 0) {
    await redisClient.del(keysToDelete);
  }
  res.clearCookie("sid").status(204).end();
};

export const deleteUser = async (req, res, next) => {
  const { userId } = req.params;
  if (req.user._id.toString() === userId) {
    return res.status(403).json({ error: "You can not delete yourself." });
  }
  try {
    await deleteSessionsByUserId(userId);
    await User.findByIdAndUpdate(userId, { deleted: true });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
