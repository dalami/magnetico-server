// -------------------------
// server.js
// -------------------------
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import multer from "multer";
import nodemailer from "nodemailer";

// 🔹 Rutas
import payRoutes from "./routes/pay.js";
import configRoutes from "./routes/config.js";
import adminRoutes from "./routes/admin.js";


// -------------------------
// Base App
// -------------------------
const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(compression());

// -------------------------
// Variables de entorno seguras
// -------------------------
const FRONTEND_URL = (process.env.FRONTEND_URL || "https://magnetico-app.vercel.app").replace(/\/+$/, "");

// -------------------------
// Log de origen para debugging
// -------------------------
app.use((req, _res, next) => {
  console.log("📩 Origin:", req.headers.origin || "(no origin)", "→", req.method, req.path);
  next();
});

// -------------------------
// CORS (Vercel + localhost)
// -------------------------
app.use(cors({
  origin(origin, cb) {
    const allowList = new Set([
      "http://localhost:5173",
      FRONTEND_URL,
    ]);
    const ok =
      !origin ||
      allowList.has(origin) ||
      /\.vercel\.app$/.test(origin);
    cb(null, ok);
  },
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  credentials: false, // no cookies
}));

// Preflight universal
app.options("*", cors());

// -------------------------
// Headers comunes
// -------------------------
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-key");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// -------------------------
// Webhook Mercado Pago
// -------------------------
app.post("/api/webhook", express.raw({ type: "application/json" }), (req, res) => {
  try {
    console.log("🟢 Webhook MP recibido:", req.body?.toString() || "(sin cuerpo)");
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Webhook error:", err?.message || err);
    res.sendStatus(500);
  }
});

// -------------------------
// Parsers
// -------------------------
app.use(express.json({ limit: "10mb" }));

// -------------------------
// Rutas principales
// -------------------------
app.use("/api/config", configRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/pay", payRoutes);

// -------------------------
// Healthcheck
// -------------------------
app.get("/", (_req, res) => res.send("Magnetico API ✅ Online"));
app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// -------------------------
// Envío de pedidos por correo (con fotos adjuntas)
// -------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 20 },
});

app.post("/api/orders", upload.array("photos"), async (req, res) => {
  const { name, email, price } = req.body;
  const files = req.files;

  if (!email || !files?.length) {
    return res.status(400).json({ error: "Faltan datos o archivos." });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.verify();

    const attachments = files.map((f) => ({
      filename: f.originalname,
      content: f.buffer,
    }));

    await transporter.sendMail({
      from: `"Magnético Fotoimanes" <${process.env.EMAIL_USER}>`,
      to: [process.env.DESTINATION_EMAIL, email],
      subject: "📸 Pedido confirmado - Magnético Fotoimanes",
      html: `
        <div style="font-family:'Poppins',sans-serif;background-color:#F9F6F1;
        padding:20px;border-radius:12px;max-width:600px;margin:auto;text-align:center">
          <img src="${process.env.LOGO_URL}" alt="Magnético" style="width:140px;margin-bottom:10px">
          <h2 style="color:#000;">¡Gracias por tu pedido, ${name || "cliente"}!</h2>
          <p style="color:#444;font-size:15px;line-height:1.6">
            Recibimos tus fotos correctamente 🧡<br>
            Monto del pedido: <b>$${Number(price || 0).toLocaleString("es-AR")}</b> ARS<br><br>
            En breve confirmaremos tu pago y comenzaremos la producción.
          </p>
          <p style="color:#666">📩 Si tenés dudas, respondé este correo.</p>
        </div>
      `,
      attachments,
    });

    res.json({ message: "Pedido enviado correctamente" });
  } catch (err) {
    console.error("❌ Error al enviar email:", err?.message || err);
    res.status(500).json({ error: "Error al procesar el pedido." });
  }
});

// -------------------------
// Start Server
// -------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server corriendo en puerto ${PORT}`);
  console.log(`🌍 FRONTEND_URL permitido: ${FRONTEND_URL}`);
});
