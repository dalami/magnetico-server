import cors from "cors";
import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import payRoutes from "./routes/orderRoutes.js";


dotenv.config();
const app = express();

// ✅ CORS: permitir explícitamente Vercel y opciones preflight
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://magnetico-app.vercel.app");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Rutas
app.use("/api/pay", payRoutes);

// ✅ Endpoint de prueba (para verificar conexión)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ✅ Envío de pedido
app.post("/api/orders", upload.array("photos"), async (req, res) => {
  const { name, email } = req.body;
  const files = req.files;

  if (!email || !files?.length)
    return res.status(400).json({ error: "Faltan datos o archivos." });

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    const attachments = files.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
    }));

    await transporter.sendMail({
      from: `"Magnético Fotoimanes" <${process.env.EMAIL_USER}>`,
      to: process.env.DESTINATION_EMAIL,
      subject: `📸 Pedido de ${name || "Cliente"} (${email})`,
      text: `Nombre: ${name}\nEmail: ${email}\nCantidad: ${files.length}`,
      attachments,
    });

    res.json({ message: "Pedido enviado correctamente ✅" });
  } catch (error) {
    console.error("❌ Error al enviar email:", error);
    res.status(500).json({ error: "Error al enviar el pedido." });
  }
});

// ✅ Render usa puerto dinámico
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
