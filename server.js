import express from "express";
import cors from "cors";
import multer from "multer";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import payRoutes from "./routes/pay.js";

dotenv.config();
const app = express();

// ✅ CORS — permití solo tu dominio de Vercel
app.use(
  cors({
    origin: ["https://magnetico-app.vercel.app", "http://localhost:5173"],
    methods: ["GET", "POST"],
  })
);

app.use(express.json());

// ✅ Multer en memoria para manejar imágenes
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Rutas
app.use("/api/pay", payRoutes);

// ✅ Webhook de Mercado Pago
app.post("/api/webhook", express.json(), (req, res) => {
  try {
    console.log("🟢 Webhook recibido:", req.body);
    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Error en webhook:", error);
    res.status(500).send("Error");
  }
});

// ✅ Envío de pedido por email
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

    res.json({ message: "Pedido enviado correctamente" });
  } catch (error) {
    console.error("❌ Error al enviar email:", error);
    res.status(500).json({ error: "Error al enviar el pedido." });
  }
});

// ✅ Render usa process.env.PORT, no puerto fijo
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));

