import express from "express";
import 'dotenv/config';
import { Resend } from "resend";
import cors from "cors";
import cookieParser from "cookie-parser";
import directoryRoutes from "./routes/directoryRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import checkAuth from "./middlewares/authMiddleware.js";
import { connectDB } from "./config/db.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js"
import crypto from "crypto";
import { exec } from "child_process";

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

app.post("/githubWebhook",(req,res)=>{
    
      const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    const secret = 'mySecret';
    const hash = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;

    if (signature !== hash) {
        console.error('Invalid signature');
        return res.sendStatus(401);
    }

    console.log('Webhook verified!');
    res.sendStatus(200);

     exec('./script.sh', (error, stdout, stderr) => {
        if (error) {
          
        const resend = new Resend(process.env.RESEND_API_KEY);
            console.error(`Error: ${error.message}`);
              resend.emails.send({
                from: 'Rahul Kumar Gupta <rahul@storage22b.space>',
                to: 'chiku22b@gmail.com',
                subject: 'Deployment Error',
                html: `<p>Deployment script failed with error: ${error.message}</p>`
              });

            return;
        }
        console.log(stdout);

        // res.send('Deployment script executed successfully');
    });


  });


app.get("/",(req,res)=>{
return res.status(200).send("<h1>Rahul Kumar Gupta</h1><p>Welcome to the Storage App API. Please refer to the documentation for usage details.</p>");
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
