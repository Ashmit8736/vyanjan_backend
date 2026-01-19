import express from "express";
import cors from "cors";
import testRoute from "./routes/testRoute.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

// test route
app.use("/", testRoute);


app.use("/api", superAdminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);

export default app;
