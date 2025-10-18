// -------------------------
// routes/order.js - VERSIÓN CON REDIRECCIÓN INMEDIATA A MERCADO PAGO
// -------------------------
import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import axios from "axios";
import { getUnitPrice } from "../services/pricing.js";

const router = express.Router();

// ------------------------------
// 🔥 Multer Configuración Optimizada
// ------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024,
    files: 20,
    fieldSize: 10 * 1024 * 1024
  }
});

// ------------------------------
// 📧 Servicio de Email al Vendedor (solo)
// ------------------------------
const sendVendorEmail = async ({ name, email, phone, address, photos, orderId }) => {
  try {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    
    if (!emailUser || !emailPass) {
      console.log("❌ No hay configuración de email para vendedor");
      return { simulated: true };
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    console.log(`📧 Enviando email al vendedor para pedido ${orderId}...`);

    const vendorAttachments = photos.map((file, index) => ({
      filename: `pedido_${orderId}_foto_${index + 1}.jpg`,
      content: file.buffer,
      contentType: 'image/jpeg'
    }));

    const vendorHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8f9fa;">
        <h2 style="color: #4CAF50;">🎉 NUEVO PEDIDO RECIBIDO</h2>
        <div style="background: white; padding: 20px; border-radius: 10px; border-left: 4px solid #4CAF50;">
          <h3>📋 Datos del Cliente</h3>
          <p><strong>Nombre:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${phone ? `<p><strong>Teléfono:</strong> ${phone}</p>` : ''}
          ${address ? `<p><strong>Dirección:</strong> ${address}</p>` : ''}
          <p><strong>Fotos:</strong> ${photos.length}</p>
          <p><strong>ID de Pedido:</strong> ${orderId}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}</p>
        </div>
        <p style="margin-top: 20px; color: #666;">
          <em>📎 ${photos.length} fotos adjuntas a este correo.</em>
        </p>
      </div>
    `;

    const vendorResult = await transporter.sendMail({
      from: `"Magnético" <${emailUser}>`,
      to: process.env.DESTINATION_EMAIL || emailUser,
      replyTo: email,
      subject: `📦 PEDIDO COMPLETO - ${orderId}`,
      html: vendorHtml,
      attachments: vendorAttachments,
    });

    console.log(`✅ Email enviado al vendedor: ${vendorResult.messageId}`);
    return { success: true, messageId: vendorResult.messageId };

  } catch (error) {
    console.error("❌ Error enviando email al vendedor:", error.message);
    return { error: error.message };
  }
};

// ------------------------------
// 💳 Mercado Pago Service
// ------------------------------
const createMercadoPagoPreference = async (name, email, photoCount, unitPrice, orderId) => {
  try {
    const mpToken = process.env.MP_ACCESS_TOKEN;
    
    if (!mpToken) {
      throw new Error("No hay token de Mercado Pago");
    }

    console.log(`💳 Creando checkout de Mercado Pago para ${orderId}...`);

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
      notification_url: process.env.WEBHOOK_URL || "https://magnetico-server-1.onrender.com/api/webhook"
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

    console.log(`✅ Checkout MP creado: ${response.data.id}`);
    return response.data;

  } catch (error) {
    console.error("❌ Error con Mercado Pago:", error.response?.data || error.message);
    throw new Error("No se pudo crear el pago: " + (error.response?.data?.message || error.message));
  }
};

// ------------------------------
// 🔄 PROCESAMIENTO EN SEGUNDO PLANO SOLO PARA EMAIL
// ------------------------------
async function processEmailBackground({ name, email, phone, address, photos, orderId }) {
  try {
    console.log(`🔄 Procesando email en segundo plano para ${orderId}...`);
    
    // Solo enviar email al vendedor (NO al cliente)
    await sendVendorEmail({
      name, email, phone, address, photos, orderId
    });

    console.log(`✅ Email de vendedor procesado para ${orderId}`);

  } catch (error) {
    console.error(`❌ Error en procesamiento de email ${orderId}:`, error);
  }
}

// ------------------------------
// 🚀 ENDPOINT PRINCIPAL - REDIRECCIÓN INMEDIATA A MERCADO PAGO
// ------------------------------
router.post("/", upload.array("photos"), async (req, res) => {
  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
  const startTime = Date.now();
  
  try {
    const { name, email, phone, address } = req.body;
    const photos = req.files || [];
    const photoCount = photos.length;

    console.log(`\n🟢 INICIANDO PEDIDO ${orderId}`);
    console.log(`📋 Datos: ${name}, ${email}`);
    console.log(`📸 Fotos: ${photoCount}`);

    // Validaciones rápidas
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ 
        success: false,
        error: "Nombre y email son obligatorios" 
      });
    }

    if (photoCount < 4) {
      return res.status(400).json({ 
        success: false,
        error: "Se requieren al menos 4 fotos" 
      });
    }

    // 🔥 CREAR PREFERENCIA DE MERCADO PAGO INMEDIATAMENTE
    console.log(`💳 Creando preferencia de Mercado Pago para ${orderId}...`);
    
    const unitPrice = getUnitPrice();
    const total = unitPrice * photoCount;

    const preference = await createMercadoPagoPreference(
      name.trim(),
      email.trim(), 
      photoCount,
      unitPrice,
      orderId
    );

    // 🔥 ENVIAR RESPUESTA CON LINK DE MERCADO PAGO
    console.log(`⚡ Enviando respuesta con link de Mercado Pago para ${orderId}`);
    
    res.status(200).json({
      success: true,
      message: "✅ Pedido procesado correctamente. Redirigiendo a Mercado Pago...",
      orderId: orderId,
      payment: {
        init_point: preference.init_point,
        preference_id: preference.id,
        total: total,
      },
      photosProcessed: photoCount,
      timestamp: new Date().toISOString()
    });

    const responseTime = Date.now() - startTime;
    console.log(`✅ Respuesta enviada en ${responseTime}ms para ${orderId}`);

    // 🔥 PROCESAR EMAIL EN SEGUNDO PLANO (no bloqueante)
    setTimeout(async () => {
      try {
        await processEmailBackground({
          name: name.trim(),
          email: email.trim(),
          phone: phone?.trim() || '',
          address: address?.trim() || '',
          photos,
          orderId
        });
      } catch (bgError) {
        console.error(`❌ Error en procesamiento de email ${orderId}:`, bgError);
      }
    }, 100);

  } catch (error) {
    console.error(`❌ ERROR en endpoint principal ${orderId}:`, error.message);
    
    const errorTime = Date.now() - startTime;
    console.log(`💥 Error ocurrido en ${errorTime}ms`);
    
    res.status(500).json({
      success: false,
      error: "Error al procesar el pedido: " + error.message,
      orderId: orderId
    });
  }
});

// HEALTH CHECK
router.get("/health", (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'order-api',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

export default router;