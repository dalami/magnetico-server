// -------------------------
// routes/order.js - VERSIÓN CON MEJOR LOGGING
// -------------------------
import express from "express";
import multer from "multer";
import axios from "axios";
import { getUnitPrice } from "../services/pricing.js";

const router = express.Router();

// ------------------------------
// 🔥 Multer Configuración
// ------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 10,
  },
});

// ------------------------------
// 📧 Servicio de Email con RESEND
// ------------------------------
const sendVendorEmailWithAttachments = async ({
  name,
  email,
  phone,
  address,
  photos,
  orderId,
}) => {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.log("❌ No hay API key de Resend configurada");
      throw new Error("RESEND_API_KEY no configurada");
    }

    console.log(`📧 Preparando email con ${photos.length} fotos...`);

    // Convertir fotos a base64
    const attachments = photos
      .slice(0, 5)
      .map((file, index) => {
        try {
          return {
            filename: `Foto_${index + 1}_${orderId}.jpg`,
            content: file.buffer.toString("base64"),
          };
        } catch (error) {
          console.error(
            `❌ Error procesando foto ${index + 1}:`,
            error.message
          );
          return null;
        }
      })
      .filter((attachment) => attachment !== null);

    console.log(`📎 ${attachments.length} fotos preparadas para enviar`);

    const emailData = {
      from: "Magnético <onboarding@resend.dev>",
      to: process.env.DESTINATION_EMAIL,
      reply_to: email,
      subject: `📦 PEDIDO CON ${photos.length} FOTOS - ${orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50; text-align: center;">🎉 NUEVO PEDIDO - ${
            photos.length
          } FOTOS</h2>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 15px 0;">
            <h3 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">📋 Datos del Cliente</h3>
            <p><strong>Nombre:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            ${
              phone
                ? `<p><strong>Teléfono:</strong> <a href="tel:${phone}">${phone}</a></p>`
                : ""
            }
            ${address ? `<p><strong>Dirección:</strong> ${address}</p>` : ""}
            <p><strong>Total de Fotos:</strong> ${photos.length}</p>
            <p><strong>Adjuntadas:</strong> ${attachments.length}</p>
            <p><strong>ID de Pedido:</strong> ${orderId}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString("es-AR")}</p>
          </div>
        </div>
      `,
      attachments: attachments,
    };

    console.log("🔄 Enviando email via Resend...");

    const response = await axios.post(
      "https://api.resend.com/emails",
      emailData,
      {
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    console.log(`✅ Email enviado exitosamente. ID: ${response.data.id}`);
    return {
      success: true,
      provider: "resend",
      photosAttached: attachments.length,
      messageId: response.data.id,
    };
  } catch (error) {
    console.error("❌ Error con Resend:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw error;
  }
};

// ------------------------------
// 💳 Mercado Pago Service CON MEJOR ERROR HANDLING
// ------------------------------
const createMercadoPagoPreference = async (
  name,
  email,
  photoCount,
  unitPrice,
  orderId
) => {
  try {
    const mpToken = process.env.MP_ACCESS_TOKEN;

    if (!mpToken) {
      console.error("❌ MP_ACCESS_TOKEN no configurado");
      throw new Error("Token de Mercado Pago no configurado");
    }

    console.log(`💳 Creando preferencia MP para ${orderId}...`);

    // 🔥 CORREGIDO: Usar URLs seguras para MP
    const frontendUrl =
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL || "https://magnetico-app.vercel.app"
        : "https://magnetico-app.vercel.app"; // 🔥 SIEMPRE HTTPS en producción

    const backendUrl =
      process.env.BACKEND_URL || "https://magnetico-server-1.onrender.com";

    const payload = {
      items: [
        {
          title: `${photoCount} Fotos Imantadas Magnético`,
          description: `Pedido de ${name} - ${photoCount} fotos personalizadas`,
          quantity: photoCount,
          currency_id: "ARS",
          unit_price: unitPrice,
        },
      ],
      payer: {
        email: email,
        name: name,
      },
      back_urls: {
        success: `${frontendUrl}/success`,
        failure: `${frontendUrl}/error`,
        pending: `${frontendUrl}/pending`,
      },
      auto_return: "approved",
      external_reference: orderId,
      notification_url: `${backendUrl}/api/webhook`,
    };

    console.log("📦 Payload MP:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      "https://api.mercadopago.com/checkout/preferences",
      payload,
      {
        headers: {
          Authorization: `Bearer ${mpToken}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    if (!response.data.init_point) {
      throw new Error("Mercado Pago no devolvió link de pago");
    }

    console.log(`✅ Preferencia MP creada: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error("❌ Error con Mercado Pago:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw new Error(
      `Error MP: ${error.response?.data?.message || error.message}`
    );
  }
};
// ------------------------------
// 🔄 PROCESAMIENTO EN SEGUNDO PLANO
// ------------------------------
async function processEmailBackground({
  name,
  email,
  phone,
  address,
  photos,
  orderId,
}) {
  try {
    console.log(`🔄 Procesando email en background para ${orderId}...`);

    const emailResult = await sendVendorEmailWithAttachments({
      name,
      email,
      phone,
      address,
      photos,
      orderId,
    });

    console.log(
      `✅ Email procesado: ${emailResult.photosAttached} fotos adjuntas`
    );
  } catch (error) {
    console.error(`⚠️ Email falló para ${orderId}:`, error.message);
    // No throw - el email es secundario
  }
}

// ------------------------------
// 🚀 ENDPOINT PRINCIPAL CON MEJOR LOGGING
// ------------------------------
router.post("/", upload.array("photos"), async (req, res) => {
  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;

  console.log(`\n🎯 NUEVO PEDIDO INICIADO: ${orderId}`);
  console.log(`📋 Headers:`, req.headers);
  console.log(`🌐 Origen: ${req.get("origin")}`);
  console.log(`📦 Content-Type: ${req.get("content-type")}`);

  try {
    const { name, email, phone, address } = req.body;
    const photos = req.files || [];
    const photoCount = photos.length;

    console.log(`✅ Datos recibidos:`, {
      name: name?.substring(0, 20),
      email: email?.substring(0, 20),
      phone: phone ? "✓" : "✗",
      address: address ? "✓" : "✗",
      photos: photoCount,
    });

    // Validaciones
    if (!name?.trim() || !email?.trim()) {
      console.log("❌ Validación fallida: nombre o email vacíos");
      return res.status(400).json({
        success: false,
        error: "Nombre y email son obligatorios",
      });
    }

    if (photoCount < 4) {
      console.log("❌ Validación fallida: menos de 4 fotos");
      return res.status(400).json({
        success: false,
        error: "Se requieren al menos 4 fotos",
      });
    }

    // Obtener precio
    let unitPrice;
    try {
      unitPrice = getUnitPrice();
      console.log(`💰 Precio unitario: $${unitPrice}`);
    } catch (priceError) {
      console.error("❌ Error obteniendo precio:", priceError);
      unitPrice = 2500; // Fallback
    }

    // Crear preferencia MP
    console.log(`💳 Creando preferencia MP...`);
    const preference = await createMercadoPagoPreference(
      name.trim(),
      email.trim(),
      photoCount,
      unitPrice,
      orderId
    );

    // Responder al cliente
    console.log(`⚡ Enviando respuesta al cliente...`);
    res.status(200).json({
      success: true,
      message:
        "✅ Pedido procesado correctamente. Redirigiendo a Mercado Pago...",
      orderId: orderId,
      payment: {
        init_point: preference.init_point,
        preference_id: preference.id,
        total: unitPrice * photoCount,
      },
      photosProcessed: photoCount,
      timestamp: new Date().toISOString(),
    });

    console.log(`🎉 Pedido ${orderId} procesado exitosamente`);

    // Email en segundo plano
    setTimeout(async () => {
      try {
        await processEmailBackground({
          name: name.trim(),
          email: email.trim(),
          phone: phone?.trim() || "",
          address: address?.trim() || "",
          photos,
          orderId,
        });
      } catch (emailError) {
        console.error(`❌ Error crítico en email background:`, emailError);
      }
    }, 500);
  } catch (error) {
    console.error(`💥 ERROR CRÍTICO en ${orderId}:`, {
      message: error.message,
      stack: error.stack,
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: "Error interno del servidor: " + error.message,
      orderId: orderId,
    });
  }
});

// ------------------------------
// 📊 ENDPOINTS ADICIONALES
// ------------------------------
router.get("/config/price", async (req, res) => {
  try {
    const unitPrice = getUnitPrice();
    res.json({
      success: true,
      price: unitPrice,
      unit_price: unitPrice,
      currency: "ARS",
    });
  } catch (error) {
    console.error("❌ Error en /config/price:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener el precio",
    });
  }
});

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "order-api",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

export default router;
