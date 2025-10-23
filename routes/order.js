// -------------------------
// routes/order.js - VERSIÓN COMPLETA CORREGIDA
// -------------------------
import express from "express";
import multer from "multer";
import axios from "axios";
import { getUnitPrice } from "../services/pricing.js";

const router = express.Router();

// ------------------------------
// 🔥 Multer Configuración MEJORADA
// ------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 20, // 🔥 Aumentado a 20 para planes
  },
});

// ------------------------------
// 📧 Servicio de Email con RESEND - CORREGIDO
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

    // Convertir fotos a base64 - MEJOR MANEJO DE ERRORES
    const attachments = photos
      .slice(0, 10) // 🔥 Aumentado a 10 fotos máximo
      .map((file, index) => {
        try {
          if (!file.buffer) {
            console.warn(`⚠️ Foto ${index + 1} sin buffer`);
            return null;
          }
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
      from: `Magnético Fotoimanes <${
        process.env.EMAIL_FROM || "no-reply@magnetico-fotoimanes.com"
      }>`,
      to: process.env.DESTINATION_EMAIL,
      reply_to: email,
      subject: `📦 Nuevo Pedido - ${photos.length} Fotoimanes - ${orderId}`,
      html: `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #8B5CF6; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; }
            .section { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #8B5CF6; }
            .total { background: #e8f5e8; padding: 15px; font-weight: bold; font-size: 1.2em; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Nuevo Pedido Recibido</h1>
                <p>Magnético Fotoimanes</p>
            </div>
            <div class="content">
                <div class="section">
                    <h3>📋 Información del Cliente</h3>
                    <p><strong>Nombre:</strong> ${name}</p>
                    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                    ${
                      phone
                        ? `<p><strong>Teléfono:</strong> <a href="tel:${phone}">${phone}</a></p>`
                        : ""
                    }
                    ${
                      address
                        ? `<p><strong>Dirección:</strong> ${address}</p>`
                        : ""
                    }
                </div>
                
                <div class="section">
                    <h3>🖼️ Detalles del Pedido</h3>
                    <p><strong>Número de Fotos:</strong> ${photos.length}</p>
                    <p><strong>ID de Pedido:</strong> ${orderId}</p>
                    <p><strong>Fecha:</strong> ${new Date().toLocaleString(
                      "es-AR"
                    )}</p>
                </div>
                
                <div class="section total">
                    <h3>💰 Resumen</h3>
                    <p><strong>Total de Fotos:</strong> ${photos.length}</p>
                    <p><strong>Fotos Adjuntas:</strong> ${
                      attachments.length
                    }</p>
                    <p style="color: #2E7D32; margin-top: 10px;">
                        <strong>📬 Este pedido requiere tu atención inmediata</strong>
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `,
      attachments: attachments,
      headers: {
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        Importance: "high",
      },
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
// 💳 Mercado Pago Service - CORREGIDO COMPLETAMENTE
// ------------------------------
const createMercadoPagoPreference = async (
  name,
  email,
  photoCount,
  unitPrice,
  totalPrice,
  orderId,
  tipo = "fotoimanes_unitario"
) => {
  try {
    const mpToken = process.env.MP_ACCESS_TOKEN;

    if (!mpToken) {
      console.error("❌ MP_ACCESS_TOKEN no configurado");
      throw new Error("Token de Mercado Pago no configurado");
    }

    console.log(`💳 Creando preferencia MP para ${orderId} (${tipo})...`);

    // URLs seguras
    const frontendUrl = "https://magnetico-fotoimanes.com";
    const backendUrl = "https://magnetico-server-1.onrender.com";

    // 🔥 CORRECCIÓN CRÍTICA: Configuración diferente para planes vs unitario
    let items;

    if (tipo === "fotoimanes_plan") {
      // 🔥 PARA PLANES: 1 item con precio total
      items = [
        {
          title: `Plan Fotoimanes - ${photoCount} unidades`,
          description: `Pedido de ${name} - ${photoCount} fotoimanes personalizados`,
          quantity: 1, // 🔥 SIEMPRE 1 para planes
          currency_id: "ARS",
          unit_price: totalPrice, // 🔥 PRECIO TOTAL del plan
        },
      ];
    } else {
      // 🔥 PARA SISTEMA UNITARIO: múltiples items
      items = [
        {
          title: `${photoCount} Fotos Imantadas Magnético`,
          description: `Pedido de ${name} - ${photoCount} fotos personalizadas`,
          quantity: photoCount, // 🔥 CANTIDAD = número de fotos
          currency_id: "ARS",
          unit_price: unitPrice, // 🔥 PRECIO UNITARIO
        },
      ];
    }

    // 🔥 SIMPLIFICAR payment_methods - QUITAR configuraciones problemáticas
    const payload = {
      items: [
        {
          title: `${photoCount} Fotos Imantadas Magnético`,
          description: `Pedido de ${name} - ${photoCount} fotos personalizadas`,
          quantity: tipo === "fotoimanes_plan" ? 1 : photoCount,
          currency_id: "ARS",
          unit_price: tipo === "fotoimanes_plan" ? totalPrice : unitPrice,
          // 🔥 AGREGAR CATEGORY_ID (CRÍTICO)
          category_id: "others", // Categoría por defecto para productos varios
        },
      ],
      // 🔥 CORRECCIÓN: Configuración MÍNIMA de payment_methods
      payment_methods: {
        // Dejar que MP use los valores por defecto
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
// 🚀 ENDPOINT PRINCIPAL - COMPLETAMENTE CORREGIDO
// ------------------------------
router.post("/", upload.array("photos"), async (req, res) => {
  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;

  console.log(`\n🎯 NUEVO PEDIDO INICIADO: ${orderId}`);
  console.log(`📋 Headers:`, req.headers);
  console.log(`🌐 Origen: ${req.get("origin")}`);

  try {
    const { name, email, phone, address, plan, cantidad, precio_total, tipo } =
      req.body;
    const photos = req.files || [];
    const photoCount = photos.length;

    console.log(`✅ Datos recibidos:`, {
      name: name?.substring(0, 20),
      email: email?.substring(0, 20),
      phone: phone ? "✓" : "✗",
      address: address ? "✓" : "✗",
      photos: photoCount,
      plan: plan || "unitario",
      cantidad: cantidad || "N/A",
    });

    // 🔥 VALIDACIONES MEJORADAS PARA PLANES
    if (!name?.trim() || !email?.trim()) {
      console.log("❌ Validación fallida: nombre o email vacíos");
      return res.status(400).json({
        success: false,
        error: "Nombre y email son obligatorios",
      });
    }

    // Validar según tipo de pedido
    if (tipo === "fotoimanes_plan" && plan && cantidad) {
      // Validación para planes
      if (photoCount !== parseInt(cantidad)) {
        console.log(
          `❌ Plan ${plan}: esperaba ${cantidad} fotos, recibió ${photoCount}`
        );
        return res.status(400).json({
          success: false,
          error: `El plan ${plan} incluye ${cantidad} fotoimanes. Subiste ${photoCount} fotos.`,
        });
      }
    } else {
      // Validación para sistema unitario
      if (photoCount < 4) {
        console.log("❌ Validación fallida: menos de 4 fotos");
        return res.status(400).json({
          success: false,
          error: "Se requieren al menos 4 fotos",
        });
      }
    }

    // Obtener precio según el tipo
    let unitPrice, totalPrice;
    try {
      if (tipo === "fotoimanes_plan" && precio_total) {
        // Usar precio del plan
        totalPrice = parseFloat(precio_total);
        unitPrice = totalPrice / photoCount; // Para cálculo interno
        console.log(
          `💰 Plan ${plan}: $${totalPrice} total ($${unitPrice} c/u)`
        );
      } else {
        // Precio unitario normal
        unitPrice = getUnitPrice();
        totalPrice = unitPrice * photoCount;
        console.log(
          `💰 Sistema unitario: $${unitPrice} c/u = $${totalPrice} total`
        );
      }
    } catch (priceError) {
      console.error("❌ Error obteniendo precio:", priceError);
      unitPrice = 2500; // Fallback
      totalPrice = unitPrice * photoCount;
    }

    // 🔥 CORRECCIÓN: Llamada correcta a createMercadoPagoPreference
    console.log(`💳 Creando preferencia MP...`);
    const preference = await createMercadoPagoPreference(
      name.trim(),
      email.trim(),
      photoCount,
      unitPrice, // 🔥 precio unitario base
      totalPrice, // 🔥 precio total
      orderId,
      tipo // 🔥 tipo de pedido
    );

    // Responder al cliente INMEDIATAMENTE
    console.log(`⚡ Enviando respuesta al cliente...`);
    res.status(200).json({
      success: true,
      message:
        "✅ Pedido procesado correctamente. Redirigiendo a Mercado Pago...",
      orderId: orderId,
      payment: {
        init_point: preference.init_point,
        preference_id: preference.id,
        total: totalPrice,
        unit_price: unitPrice,
      },
      photosProcessed: photoCount,
      plan: plan || null,
      timestamp: new Date().toISOString(),
    });

    console.log(`🎉 Pedido ${orderId} procesado exitosamente`);

    // Email en segundo plano (NO bloquear la respuesta)
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
    });

    // 🔥 MEJOR MANEJO DE ERRORES
    let errorMessage = "Error interno del servidor";
    let statusCode = 500;

    if (error.message.includes("Mercado Pago")) {
      errorMessage = error.message;
    } else if (error.message.includes("validación")) {
      errorMessage = error.message;
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
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
