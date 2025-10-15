// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import multer from "multer";
import nodemailer from "nodemailer";

import payRoutes from "./routes/pay.js";

const app = express();

// ── Seguridad/Performance
app.set("trust proxy", 1);
app.use(helmet());
app.use(compression());

// ── CORS
const FRONTEND_URL = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");
const EXTRA_ORIGINS = (process.env.CORS_EXTRA_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: [FRONTEND_URL, "http://localhost:5173", ...EXTRA_ORIGINS].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// ── Webhook MP: necesita RAW (declará ANTES de express.json)
app.post(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      console.log("🟢 Webhook MP recibido:", req.body?.toString() || "Sin cuerpo");
      return res.status(200).send("OK");
    } catch (e) {
      console.error("❌ Error webhook:", e);
      return res.sendStatus(500);
    }
  }
);

app.get("/", (_req, res) => res.send("Magnetico API running ✅"));
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", ts: new Date().toISOString() })
);

// ── Pago MP
app.use("/api/pay", payRoutes);

// ── Envío de pedido por email (adjuntando fotos en memoria)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 20 }, // 5MB c/u, máx 20
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
        pass: process.env.EMAIL_PASS, // App Password de Google
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

    return res.json({ message: "Pedido enviado correctamente" });
  } catch (err) {
    console.error("❌ Error al enviar email:", err?.message || err);
    return res.status(500).json({ error: "Error al procesar el pedido." });
  }
});

// ── Arranque (Render usa app.listen)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server on :${PORT}`);
  console.log(`🌍 FRONTEND_URL: ${FRONTEND_URL || "no definido"}`);
});
