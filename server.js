// -------------------------
// server.js - CONFIGURADO PARA RENDER
// -------------------------
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { Resend } from "resend";

// 🔹 Rutas
import configRoutes from "./routes/config.js";
import adminRoutes from "./routes/admin.js";
import orderRoutes from "./routes/order.js";

// -------------------------
// Configuración para ES modules
// -------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------
// Configuración inicial
// -------------------------
const app = express();
const isProduction = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 3001; // ✅ Render usa process.env.PORT

// 🎯 OBTENER URL DE RENDER DINÁMICAMENTE
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const WEBHOOK_URL = `${RENDER_URL}/api/webhook`;

console.log(`🌍 RENDER_URL: ${RENDER_URL}`);
console.log(`🔗 WEBHOOK_URL: ${WEBHOOK_URL}`);

// -------------------------
// Middlewares de seguridad
// -------------------------
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(compression());

// -------------------------
// Logging
// -------------------------
app.use(morgan(isProduction ? "combined" : "dev"));

// -------------------------
// Configuración CORS para Render
// -------------------------
const FRONTEND_URL = process.env.FRONTEND_URL || "https://magnetico-fotoimanes.com";
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  FRONTEND_URL,
  "https://www.magnetico-fotoimanes.com",
  "https://magnetico-fotoimanes.com",
].filter(Boolean);

console.log(`🌍 Entorno: ${process.env.NODE_ENV || "development"}`);
console.log(`🔗 FRONTEND_URL permitido: ${FRONTEND_URL}`);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
        return callback(null, true);
      }
      if (isProduction && origin.includes("magnetico-fotoimanes.com")) {
        return callback(null, true);
      }
      console.warn(`🚫 Origen bloqueado: ${origin}`);
      return callback(new Error("No permitido por CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-admin-key",
      "x-requested-with",
    ],
    maxAge: 86400,
  })
);

// -------------------------
// Middlewares de parsing
// -------------------------
app.use(
  express.json({
    limit: "20mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// -------------------------
// WEBHOOK MP - COLOCAR ANTES DEL RATE LIMITING
// -------------------------
let webhookLogs = [];

app.post(
  "/api/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req, res) => {
    console.log("🎯🎯🎯 WEBHOOK HANDLER EJECUTADO 🎯🎯🎯");

    const logEntry = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      method: "POST",
      path: "/api/webhook",
      bodyLength: req.body?.length,
      userAgent: req.headers["user-agent"],
    };

    webhookLogs.push(logEntry);
    console.log("🔔🔔🔔 WEBHOOK MP RECIBIDO 🔔🔔🔔");
    console.log("📋 Log entry:", logEntry);

    try {
      if (!req.body || req.body.length === 0) {
        console.log("❌ Webhook sin body");
        return res.status(400).json({ error: "Body vacío" });
      }

      const payload = req.body.toString();
      console.log(`📦 Body recibido (${payload.length} bytes)`);

      const data = JSON.parse(payload);
      console.log("🎯 Tipo de webhook:", data.type);

      if (data.type === "payment") {
        const paymentId = data.data.id;
        console.log(`💰 Procesando pago: ${paymentId}`);

        // ... resto de tu código del webhook igual
        // (mantené todo el código del webhook que ya tenés)
      }

      res.status(200).json({ status: "webhook received", processed: true });
    } catch (error) {
      console.error("💥💥💥 ERROR CRÍTICO EN WEBHOOK:", error.message);
      res.status(200).json({ status: "error_handled", message: "Error processed, no retry needed" });
    }
  }
);

// -------------------------
// ENDPOINTS DE DEBUG PARA WEBHOOK (ACTUALIZADOS)
// -------------------------
app.get("/api/webhook-status", (req, res) => {
  res.json({
    webhookUrl: WEBHOOK_URL, // ✅ Usar URL dinámica de Render
    environment: process.env.NODE_ENV,
    resendConfigured: !!process.env.RESEND_API_KEY,
    mercadopagoConfigured: !!process.env.MP_ACCESS_TOKEN,
    serverTime: new Date().toISOString(),
    webhookActive: true,
    totalWebhookCalls: webhookLogs.length,
    lastWebhookCall: webhookLogs.length > 0 ? webhookLogs[webhookLogs.length - 1].timestamp : "never",
  });
});

app.get("/api/debug/webhook", (req, res) => {
  res.json({
    status: "active",
    webhookUrl: WEBHOOK_URL, // ✅ Usar URL dinámica de Render
    environment: process.env.NODE_ENV || "development",
    serverTime: new Date().toISOString(),
    // ... resto del código igual
  });
});

// ... resto de tu código igual

// -------------------------
// Iniciar servidor
// -------------------------
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`
🚀 Servidor Magnetico iniciado EN RENDER
📍 Puerto: ${PORT}
🌍 Host: 0.0.0.0
🏠 Entorno: ${process.env.NODE_ENV || "development"}
📅 Iniciado: ${new Date().toISOString()}
🔗 Webhook: ${WEBHOOK_URL}  // ✅ Mostrar URL correcta
📧 Resend: ${process.env.RESEND_API_KEY ? "✅ Configurado" : "❌ No configurado"}
💰 MercadoPago: ${process.env.MP_ACCESS_TOKEN ? "✅ Configurado" : "❌ No configurado"}
  `);
});

export default app;