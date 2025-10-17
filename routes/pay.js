// routes/pay.js
import express from "express";
import axios from "axios";
import crypto from "crypto";
import multer from "multer";
import nodemailer from "nodemailer";
import { getUnitPrice } from "../services/pricing.js";

const router = express.Router();

// Configuración de multer para recibir fotos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 20 },
});

router.post("/order", upload.array("photos"), async (req, res) => {
  try {
    const { name, email } = req.body;
    const photos = req.files || [];
    const qty = photos.length;

    // Validaciones
    if (!name?.trim() || !email?.trim() || qty === 0) {
      return res.status(400).json({ error: "Faltan nombre, email o fotos." });
    }

    const unit = getUnitPrice();
    const total = unit * qty;
    const uniqueId = crypto.randomBytes(6).toString("hex");
    const FRONTEND_URL = (process.env.FRONTEND_URL || "https://magnetico-app.vercel.app")
      .trim()
      .replace(/\/+$/, "");

    console.log("======================================");
    console.log("🧮 Nuevo pedido recibido:");
    console.log("👤 Nombre:", name);
    console.log("📧 Email:", email);
    console.log("🖼️ Cantidad:", qty);
    console.log("💵 Precio unitario:", unit);
    console.log("💰 Total:", total);
    console.log("======================================");

    // 🧾 Payload para Mercado Pago
    const payload = {
      items: [
        {
          id: `pedido-${uniqueId}`,
          title: `${qty} foto${qty > 1 ? "s" : ""} imantada${qty > 1 ? "s" : ""}`,
          description: "Fotos personalizadas Magnético Fotoimanes",
          quantity: qty,
          unit_price: unit,
          currency_id: "ARS",
        },
      ],
      payer: { email },
      back_urls: {
        success: `${FRONTEND_URL}/success?ref=${uniqueId}`,
        failure: `${FRONTEND_URL}/error?ref=${uniqueId}`,
        pending: `${FRONTEND_URL}/pending?ref=${uniqueId}`,
      },
      auto_return: "approved",
      external_reference: uniqueId,
      statement_descriptor: "MAGNETICO",
      metadata: { name, email, qty, unit, total },
    };

    console.log("🚀 Enviando solicitud a Mercado Pago...");

    // 🚀 Crear preferencia en Mercado Pago — ¡URL SIN ESPACIOS!
   const mpResponse = await axios.post(
  "https://api.mercadopago.com/checkout/preferences",
  payload,
  {
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    timeout: 10000, // 10 segundos
  }
);

    console.log("✅ Orden de MP creada:", mpResponse.data.id);

    // ✅ Configurar transporte de correo
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

    console.log("📧 Enviando correo al administrador...");
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
          <p><b>Total:</b> $${total.toLocaleString("es-AR")}</p>
        </div>
      `,
      attachments,
    });

    console.log("📨 Enviando confirmación al cliente...");
    await transporter.sendMail({
      from: `"Magnético Fotoimanes" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "📸 Confirmación de tu pedido - Magnético",
      html: `
        <div style="font-family: Poppins, sans-serif; text-align: center; background: #f9f6f1; padding: 20px; border-radius: 12px;">
          <h2>¡Gracias por tu pedido, ${name}!</h2>
          <p>Recibimos tus ${qty} foto${qty > 1 ? "s" : ""} correctamente 🧡</p>
          <p><b>Monto:</b> $${total.toLocaleString("es-AR")}</p>
          <p>En breve confirmaremos tu pago y comenzaremos la producción.</p>
        </div>
      `,
    });

    // Devolver URL de pago
    const isSandbox = (process.env.MP_ACCESS_TOKEN || "").startsWith("TEST-");
    const init_point = isSandbox ? mpResponse.data.sandbox_init_point : mpResponse.data.init_point;

    console.log("🔗 Redirigiendo a:", init_point);
    res.status(201).json({ init_point });

  } catch (error) {
    console.error("❌ Error en /pay/order:", error.response?.data || error.message || error);
    res.status(500).json({ error: "Error al procesar el pedido. Por favor, intentá nuevamente." });
  }
});

export default router;