import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import directoryRoutes from "./routes/directoryRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import checkAuth from "./middlewares/authMiddleware.js";
import { connectDB } from "./config/db.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js"
await connectDB();

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(express.json());
app.use(
  cors({
    origin: [process.env.CLIENT_URL,"https://storage22b.netlify.app","https://www.storage22b.space"],
    credentials: true,
  })
);

app.options('*', cors());

app.get("/",(req,res)=>{
  res.setHeaders ({
    "Content-Type": "text/html"
  });
return res.status(200).send("<h1>Storage App API</h1><p>Welcome to the Storage App API. Please refer to the documentation for usage details.</p>");
})

app.use("/directory", checkAuth, directoryRoutes);
app.use("/file", checkAuth, fileRoutes);
app.use("/", userRoutes);
app.use("/auth", authRoutes);
app.use("/subscription", subscriptionRoutes);

app.use((err, req, res, next) => {
  console.log(err);
  res.status(500).json({ error: "Internal Server Error" });
});

const host=process.env.HOST;


app.listen(PORT,host, () => {
  console.log(`Server Started`);
});


// https://stackoverflow.com/questions/18367824/how-to-cancel-http-upload-from-data-events