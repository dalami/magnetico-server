// -------------------------
// server.js
// -------------------------
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

// 🔹 Rutas
import payRoutes from "./routes/pay.js";
import configRoutes from "./routes/config.js";
import adminRoutes from "./routes/admin.js";

// -------------------------
// App base
// -------------------------
const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(compression());

// -------------------------
// Variables y logs
// -------------------------
const FRONTEND_URL = (process.env.FRONTEND_URL || "https://magnetico-app.vercel.app").replace(/\/+$/, "");
console.log(`🌍 FRONTEND_URL permitido: ${FRONTEND_URL}`);

// -------------------------
// CORS seguro
// -------------------------
app.use(cors({
  origin(origin, cb) {
    const allowList = new Set([
      "http://localhost:5173",
      FRONTEND_URL,
    ]);
    const ok = !origin || allowList.has(origin) || /\.vercel\.app$/.test(origin);
    cb(null, ok);
  },
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
}));

app.options("*", cors());

// -------------------------
// Healthcheck
// -------------------------
app.get("/", (_req, res) => res.send("🟢 Magnetico API Online"));
app.get("/api/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// -------------------------
// Parsers
// -------------------------
app.use(express.json({ limit: "10mb" }));

// -------------------------
// Rutas modulares
// -------------------------
app.use("/api/config", configRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/pay", payRoutes);

// -------------------------
// Webhook MP (opcional, pero recomendado)
// -------------------------
app.post("/api/webhook", express.raw({ type: "application/json" }), (req, res) => {
  console.log("🟢 Webhook MP recibido:", req.body?.toString() || "(sin cuerpo)");
  res.status(200).send("OK");
});

// -------------------------
// Iniciar servidor
// -------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));