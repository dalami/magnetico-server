// routes/order.js
import { Router } from "express";
import multer from "multer";
import nodemailer from "nodemailer";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 20 },
});

router.post("/", upload.array("photos"), async (req, res) => {
  try {
    const { name, email } = req.body;
    const photos = req.files || [];
    const qty = photos.length;

    if (!name?.trim() || !email?.trim() || qty === 0) {
      return res.status(400).json({ error: "Faltan nombre, email o fotos." });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const attachments = photos.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype,
    }));

    // Correo al administrador
    await transporter.sendMail({
      from: `"Magnético" <${process.env.EMAIL_USER}>`,
      to: process.env.DESTINATION_EMAIL,
      subject: `🧾 Nuevo pedido - ${name}`,
      html: `
        <div style="font-family: Poppins, sans-serif;">
          <h2>Nuevo pedido recibido</h2>
          <p><b>Cliente:</b> ${name}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Cantidad de fotos:</b> ${qty}</p>
        </div>
      `,
      attachments,
    });

    // Correo al cliente
    await transporter.sendMail({
      from: `"Magnético Fotoimanes" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "📸 Tus fotos fueron recibidas",
      html: `
        <div style="font-family: Poppins, sans-serif; text-align: center; background: #f9f6f1; padding: 20px; border-radius: 12px;">
          <h2>¡Gracias, ${name}!</h2>
          <p>Tus ${qty} foto${qty > 1 ? "s" : ""} fueron recibidas correctamente 🧡</p>
          <p>Ahora podés proceder al pago para finalizar tu pedido.</p>
        </div>
      `,
    });

    console.log(`✅ Correos enviados: ${name} (${email}) - ${qty} fotos`);
    res.status(200).json({ success: true });

  } catch (error) {
    console.error("❌ Error en /send-photos:", error.message);
    res.status(500).json({ error: "Error al enviar las fotos. Intentá nuevamente." });
  }
});

export default router;