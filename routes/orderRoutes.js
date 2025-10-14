import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// ruta POST para recibir fotos y datos
router.post("/orders", upload.array("photos"), async (req, res) => {
  const { name, email } = req.body;
  const files = req.files;

  try {
    // configurar transporte de mail
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
      from: process.env.EMAIL_USER,
      to: process.env.DESTINATION_EMAIL,
      subject: `Nuevo pedido de ${name || "Cliente"} (${email})`,
      text: `Cliente: ${name}\nEmail: ${email}\nCantidad de fotos: ${files.length}`,
      attachments,
    });

    res.json({ message: "Correo enviado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al enviar el correo" });
  }
});

export default router;
