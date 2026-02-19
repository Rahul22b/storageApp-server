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




app.post("/githubWebhook", (req, res) => {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    const secret = 'mySecret'; // Use env variables!

    // Compute the hash
    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from('sha256=' + hmac.update(payload).digest('hex'), 'utf8');
    const checksum = Buffer.from(signature, 'utf8');

    // Timing-safe comparison
    if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {

        console.error('Invalid signature');
        return res.sendStatus(401);
    }

    console.log('Webhook verified!');
    res.sendStatus(200); // Respond to GitHub immediately

    // Identify which repo triggered the hook
    const repoName = req.body.repository.name; 
    let scriptToRun = '';

    if (repoName === 'storageApp-client') {
        scriptToRun = 'frontend-script.sh';
    } else if (repoName === 'storageApp-server') {
        scriptToRun = 'backend-script.sh';
    }

    // Only execute if a valid repo was matched
    if (scriptToRun) {
        exec(`./${scriptToRun}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                
                // Alerting via Resend
                const resend = new Resend(process.env.RESEND_API_KEY);
                resend.emails.send({
                    from: 'Rahul Kumar Gupta <rahul@storage22b.space>',
                    to: 'chiku22b@gmail.com',
                    subject: `Deployment Error: ${repoName}`,
                    html: `<p>Deployment script <b>${scriptToRun}</b> failed with error: ${error.message}</p>`
                });
                return;
            }
            console.log(`STDOUT: ${stdout}`);
        });
    } else {
        console.log(`No script defined for repository: ${repoName}`);
    }
});

app.get("/",(req,res)=>{
return res.status(200).send("<h1>Sana I love you</h1><p>Welcome to the Storage App API. Please refer to the documentation for usage details.</p>");
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
