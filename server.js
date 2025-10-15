import express from "express";
import cors from "cors";
import multer from "multer";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import payRoutes from "./routes/pay.js";

dotenv.config();
const app = express();

// ✅ CORS configurado correctamente
app.use(
  cors({
    origin: [
      "https://magnetico-app.vercel.app", // tu dominio en producción
      "http://localhost:5173"             // para pruebas locales
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

// ✅ Multer en memoria (para subir imágenes)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Ruta de prueba
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});


// ✅ Ruta de pago
app.use("/api/pay", payRoutes);

// ✅ Webhook de Mercado Pago (opcional)
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
  const { name, email, price } = req.body;
  const files = req.files;

  if (!email || !files?.length)
    return res.status(400).json({ error: "Faltan datos o archivos." });

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const attachments = files.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
    }));

    await transporter.sendMail({
      from: `"Magnético Fotoimanes" <${process.env.EMAIL_USER}>`,
      to: [process.env.DESTINATION_EMAIL, email], // 👈 envío doble
      subject: `📸 Pedido confirmado - Magnético Fotoimanes`,
      html: `
        <div style="font-family:'Poppins',sans-serif;background-color:#F9F6F1;
        padding:20px;border-radius:12px;max-width:600px;margin:auto;text-align:center">
          <img src="${process.env.LOGO_URL}" alt="Magnético" style="width:140px;margin-bottom:10px">
          <h2 style="color:#000;">¡Gracias por tu pedido, ${name}!</h2>
          <p style="color:#444;font-size:15px;line-height:1.6">
            Recibimos tus fotos correctamente 🧡<br>
            Monto del pedido: <b>$${price}</b> ARS<br><br>
            En breve confirmaremos tu pago y comenzaremos la producción.
          </p>
          <p style="color:#666">📩 Si tenés dudas, respondé este correo.</p>
        </div>
      `,
      attachments,
    });

    res.json({ message: "Pedido enviado correctamente" });
  } catch (error) {
    console.error("❌ Error al enviar email:", error);
    res.status(500).json({ error: "Error al enviar el pedido." });
  }
});

// ✅ Puerto dinámico (para Render)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
