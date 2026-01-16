import express from "express";
import cors from "cors";
import testRoute from "./routes/testRoute.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

// test route
app.use("/", testRoute);


app.use("/api", superAdminRoutes);

export default app;
