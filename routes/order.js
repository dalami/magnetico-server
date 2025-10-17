// -------------------------
// routes/order.js - VERSIÓN DEFINITIVA CORREGIDA
// -------------------------
import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import axios from "axios";
import crypto from "crypto";
import { getUnitPrice } from "../services/pricing.js";

const router = express.Router();

// ------------------------------
// 🔥 Multer
// ------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 20 * 1024 * 1024,
    files: 30,
  }
});

// ------------------------------
// 📧 Email Service - FORZADO A FUNCIONAR
// ------------------------------
const sendEmails = async (name, email, photos, orderId) => {
  try {
    // 🔥 FORZAR CONFIGURACIÓN DIRECTA
    const emailUser = process.env.EMAIL_USER || "diegoalami@gmail.com";
    const emailPass = process.env.EMAIL_PASS || "cqzldwusjnajheqh";
    
    if (!emailUser || !emailPass) {
      console.log("❌ No hay configuración de email");
      return { vendor: { simulated: true }, client: { simulated: true } };
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    console.log("📧 Intentando enviar emails REALES...");

    // Email al VENDEDOR con fotos adjuntas
    const vendorAttachments = photos.map((file, index) => ({
      filename: `foto_${index + 1}.jpg`,
      content: file.buffer,
      contentType: 'image/jpeg'
    }));

    const vendorResult = await transporter.sendMail({
      from: `"Magnético" <${emailUser}>`,
      to: process.env.DESTINATION_EMAIL || emailUser,
      subject: `📸 NUEVO PEDIDO - ${orderId}`,
      html: `
        <h2>🎉 Nuevo Pedido Recibido</h2>
        <p><strong>Cliente:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Fotos:</strong> ${photos.length}</p>
        <p><strong>ID:</strong> ${orderId}</p>
        <p><em>Las fotos están adjuntas a este correo.</em></p>
      `,
      attachments: vendorAttachments
    });

    console.log("✅ Email REAL enviado al vendedor:", vendorResult.messageId);

    // Email al CLIENTE
    const clientResult = await transporter.sendMail({
      from: `"Magnético" <${emailUser}>`,
      to: email,
      subject: "✅ Confirmación de Pedido - Magnético",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #4CAF50;">¡Gracias por tu pedido, ${name}!</h2>
          <p>Hemos recibido tus <strong>${photos.length} fotos</strong> correctamente.</p>
          <p><strong>ID de Pedido:</strong> ${orderId}</p>
          <p>Te contactaremos a la brevedad para coordinar el envío.</p>
          <br>
          <p><em>Equipo Magnético</em></p>
        </div>
      `
    });

    console.log("✅ Email REAL enviado al cliente:", clientResult.messageId);

    return {
      vendor: { success: true, messageId: vendorResult.messageId },
      client: { success: true, messageId: clientResult.messageId }
    };

  } catch (error) {
    console.error("❌ Error enviando emails:", error.message);
    return {
      vendor: { error: error.message },
      client: { error: error.message }
    };
  }
};

// ------------------------------
// 💳 Mercado Pago Service - FORZADO A FUNCIONAR
// ------------------------------
const createMercadoPagoPreference = async (name, email, photoCount, unitPrice, orderId) => {
  try {
    // 🔥 FORZAR TOKEN DIRECTAMENTE
    const mpToken = process.env.MP_ACCESS_TOKEN || "APP_USR-7889157239392520-101413-f2f008a3a3d103930d4a335d47bf7a95-38101301";
    
    if (!mpToken) {
      throw new Error("No hay token de Mercado Pago");
    }

    console.log("💳 Creando checkout REAL de Mercado Pago...");

    const payload = {
      items: [
        {
          title: `${photoCount} Fotos Imantadas Magnético`,
          description: `Pedido de ${name} - ${photoCount} fotos personalizadas`,
          quantity: photoCount,
          currency_id: "ARS",
          unit_price: unitPrice
        }
      ],
      payer: {
        email: email,
        name: name
      },
      back_urls: {
        success: "https://magnetico-app.vercel.app/success",
        failure: "https://magnetico-app.vercel.app/error", 
        pending: "https://magnetico-app.vercel.app/pending"
      },
      auto_return: "approved",
      external_reference: orderId,
      notification_url: "https://magnetico-server-1.onrender.com/api/webhook"
    };

    const response = await axios.post(
      "https://api.mercadopago.com/checkout/preferences",
      payload,
      {
        headers: {
          "Authorization": `Bearer ${mpToken}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    console.log("✅ Checkout MP REAL creado:", response.data.id);
    return response.data;

  } catch (error) {
    console.error("❌ Error con Mercado Pago:", error.response?.data || error.message);
    throw new Error("No se pudo crear el pago: " + (error.response?.data?.message || error.message));
  }
};

// ------------------------------
// 🚀 ENDPOINT PRINCIPAL - DEFINITIVO
// ------------------------------
router.post("/", upload.array("photos"), async (req, res) => {
  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
  
  try {
    const { name, email } = req.body;
    const photos = req.files || [];
    const photoCount = photos.length;

    console.log("🟢 INICIANDO PEDIDO REAL:", { name, email, photoCount });

    // Validaciones
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ 
        success: false,
        error: "Por favor completá tu nombre y email." 
      });
    }

    if (photoCount < 4) {
      return res.status(400).json({ 
        success: false,
        error: "Subí al menos 4 fotos para realizar el pedido." 
      });
    }

    // 📧 ENVIAR EMAILS (no esperar, hacerlo en background)
    sendEmails(name, email, photos, orderId)
      .then(result => {
        console.log("📧 Resultado final emails:", result);
      })
      .catch(error => {
        console.error("📧 Error en background emails:", error);
      });

    // 💳 CREAR PAGO REAL CON MERCADO PAGO
    const unitPrice = getUnitPrice();
    const total = unitPrice * photoCount;

    console.log("💰 Procesando pago:", { unitPrice, photoCount, total });

    const preference = await createMercadoPagoPreference(
      name, 
      email, 
      photoCount, 
      unitPrice, 
      orderId
    );

    // 🎯 RESPUESTA INMEDIATA CON REDIRECCIÓN
    res.status(200).json({
      success: true,
      message: "✅ Pedido procesado. Redirigiendo a Mercado Pago...",
      orderId: orderId,
      payment: {
        init_point: preference.init_point, // ✅ URL REAL de MP
        preference_id: preference.id,
        total: total,
        is_real: true // ✅ CONFIRMACIÓN DE QUE ES REAL
      },
      redirect: true, // ✅ INDICAR QUE DEBE REDIRIGIR
      summary: {
        photosReceived: photoCount,
        total: total
      }
    });

    console.log(`🎉 PEDIDO ${orderId} ENVIADO A MERCADO PAGO`);

  } catch (error) {
    console.error("❌ ERROR CRÍTICO:", error.message);
    
    res.status(500).json({
      success: false,
      error: "Error al procesar el pago: " + error.message,
      orderId: orderId
    });
  }
});

// 🔥 EXPORT DEFAULT CORREGIDO - ESTO ES LO QUE FALTABA
export default router;