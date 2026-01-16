import express from "express";
import cors from "cors";
import testRoute from "./routes/testRoute.js";

const app = express();

app.use(cors());
app.use(express.json());

// test route
app.use("/", testRoute);

export default app;
