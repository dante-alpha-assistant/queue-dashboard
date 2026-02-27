import express from "express";
import cors from "cors";
import { router } from "./routes/tasks.js";
import { chatRouter } from "./routes/chat.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", router);
app.use("/api/chat", chatRouter);

// Serve static frontend in production
import { serveStatic } from "./static.js";
serveStatic(app);

const PORT = process.env.PORT || 9092;
app.listen(PORT, () => console.log(`Queue dashboard API on :${PORT}`));
