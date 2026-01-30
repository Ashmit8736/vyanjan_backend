import express from "express";
import cors from "cors";
import testRoute from "./routes/testRoute.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import unitRoutes from "./routes/unitRoutes.js";
import rawMaterialRoutes from "./routes/rawMaterialRoutes.js";
import StockRoutes from "./routes/StockRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import purchaseOrderRoutes from "./routes/purchaseOrderRoutes.js";
import stockPurchaseItemRoutes from "./routes/stockPurchaseItemRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

// test route
app.use("/", testRoute);


app.use("/api", superAdminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/raw", rawMaterialRoutes);
app.use("/api/stock", StockRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/purchaseOrders", purchaseOrderRoutes);
app.use("/api/stockPurchaseItems", stockPurchaseItemRoutes);


export default app;