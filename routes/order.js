// -------------------------
// routes/order.js - VERSIÓN SIN WEBHOOK
// -------------------------
import express from "express";
import multer from "multer";
import axios from "axios";
import cors from "cors";
import { Resend } from "resend";

const router = express.Router();

// Configurar CORS
router.use(
  cors({
    origin: [
      "https://magnetico-fotoimanes.com",
      "https://www.magnetico-fotoimanes.com",
    ],
    credentials: true,
  })
);

// Configuración de multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 20,
  },
});

// Precio corregido
const getUnitPrice = () => 4000;

// 🔥 CONFIGURACIÓN DE RESEND
let resend;
try {
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      "⚠️ RESEND_API_KEY no configurada. Los emails no se enviarán."
    );
  } else {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log("✅ Resend configurado correctamente");
  }
} catch (error) {
  console.error("❌ Error configurando Resend:", error.message);
}

// 🔥 1. EMAIL DE PEDIDO RECIBIDO CON FOTOS ADJUNTAS
const sendOrderReceivedEmail = async (orderData, photos) => {
  try {
    if (!resend) {
      console.log("📧 Resend no configurado - Simulando envío de email");
      console.log("📋 Datos del pedido:", orderData);
      return true;
    }

    console.log("📧 Enviando email con fotos adjuntas...");

    // 🔥 PREPARAR ATTACHMENTS
    const attachments = photos.map((photo, index) => ({
      filename: `foto_${index + 1}.jpg`,
      content: photo.buffer.toString("base64"),
      contentType: "image/jpeg",
    }));

    console.log(`📎 Preparando ${attachments.length} archivos adjuntos`);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .header { background: #BCA88F; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .order-details { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .photos-details { background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #4CAF50; }
            .total { font-size: 1.2em; font-weight: bold; color: #2E7D32; }
            .status { color: #BCA88F; font-weight: bold; }
            .photo-item { margin: 5px 0; padding: 5px; background: white; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📦 NUEVO PEDIDO RECIBIDO</h1>
            <p>Orden: ${orderData.orderId}</p>
          </div>
          <div class="content">
            <div class="status">🟡 PENDIENTE DE PAGO</div>
            
            <h2>👤 Información del Cliente</h2>
            <p><strong>Nombre:</strong> ${orderData.name}</p>
            <p><strong>Email:</strong> ${orderData.email}</p>
            <p><strong>Teléfono:</strong> ${
              orderData.phone || "No proporcionado"
            }</p>
            <p><strong>Dirección:</strong> ${
              orderData.address || "No proporcionada"
            }</p>
            
            <div class="order-details">
              <h2>📸 Detalles del Pedido</h2>
              <p><strong>Plan:</strong> ${orderData.plan || "Unitario"}</p>
              <p><strong>Cantidad de fotos:</strong> ${orderData.photoCount}</p>
              <p><strong>Precio unitario:</strong> $${orderData.unitPrice}</p>
              <p class="total">Total: $${orderData.totalPrice}</p>
            </div>

            <div class="photos-details">
              <h2>🖼️ Fotos Adjuntas (${photos.length})</h2>
              <p><strong>✅ Las fotos están adjuntas a este email y listas para descargar.</strong></p>
              <div style="background: white; padding: 10px; border-radius: 5px; margin: 10px 0;">
                ${photos
                  .map(
                    (photo, index) =>
                      `<div class="photo-item">
                    <strong>Foto ${index + 1}:</strong> ${
                        photo.originalname
                      } (${Math.round(photo.size / 1024)} KB)
                   </div>`
                  )
                  .join("")}
              </div>
              <p><em>💡 Todas las fotos están comprimidas y listas para producción.</em></p>
            </div>
            
            <p><strong>ID de Pago MP:</strong> ${orderData.mpPreferenceId}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString("es-AR")}</p>
            <p><em>El pedido está pendiente de pago. Se enviará confirmación cuando se complete el pago.</em></p>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "Magnético Fotoimanes <pedidos@magnetico-fotoimanes.com>",
      to: "pedidos@magnetico-fotoimanes.com",
      subject: `📦 Pedido ${orderData.orderId} - ${orderData.photoCount} Fotos - $${orderData.totalPrice}`,
      html: emailHtml,
      attachments: attachments,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log(
      `✅ Email con ${attachments.length} fotos adjuntas enviado correctamente`
    );
    return true;
  } catch (error) {
    console.error("❌ Error enviando email con adjuntos:", error.message);
    return false;
  }
};

// 🔥 2. EMAIL DE CONFIRMACIÓN AL CLIENTE (SIN ADJUNTOS)
const sendCustomerConfirmationEmail = async (orderData) => {
  try {
    if (!resend) {
      console.log("📧 Resend no configurado - Simulando envío al cliente");
      return true;
    }

    console.log("📧 Enviando email al cliente...");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .header { background: #BCA88F; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .order-details { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .total { font-size: 1.2em; font-weight: bold; color: #2E7D32; }
            .button { background: #BCA88F; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>¡Pedido Recibido! 🎉</h1>
            <p>Gracias por tu compra en Magnético</p>
          </div>
          <div class="content">
            <h2>Hola ${orderData.name},</h2>
            <p>Hemos recibido tu pedido correctamente y está pendiente de pago.</p>
            
            <div class="order-details">
              <h3>📋 Resumen de tu pedido</h3>
              <p><strong>Número de orden:</strong> ${orderData.orderId}</p>
              <p><strong>Producto:</strong> ${orderData.photoCount} Fotoimanes Magnético</p>
              <p><strong>Precio unitario:</strong> $${orderData.unitPrice}</p>
              <p class="total">Total: $${orderData.totalPrice}</p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <a href="${orderData.paymentLink}" class="button">
                💳 PAGAR $${orderData.totalPrice}
              </a>
            </div>

            <p><strong>✅ Hemos recibido tus ${orderData.photoCount} fotos correctamente</strong></p>
            <p><strong>Próximos pasos:</strong></p>
            <ol>
              <li>Completá el pago usando el botón arriba</li>
              <li>Recibirás la confirmación por email</li>
              <li>Procesaremos tus ${orderData.photoCount} fotoimanes en 24-48 horas</li>
            </ol>

            <p>Si tenés alguna duda, respondé a este email.</p>
            
            <p>¡Gracias por elegirnos!<br>El equipo de <strong>Magnético</strong></p>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "Magnético Fotoimanes <pedidos@magnetico-fotoimanes.com>",
      to: orderData.email,
      subject: `📦 Confirmación de Pedido - ${orderData.orderId} - $${orderData.totalPrice}`,
      html: emailHtml,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log(`✅ Email enviado al cliente: $${orderData.totalPrice}`);
    return true;
  } catch (error) {
    console.error("❌ Error enviando email al cliente:", error.message);
    return false;
  }
};

// 🔥 FUNCIÓN MERCADO PAGO (SIN WEBHOOK)
const createMercadoPagoPreference = async (orderData) => {
  try {
    const mpToken = process.env.MP_ACCESS_TOKEN;

    if (!mpToken) {
      throw new Error("MP_ACCESS_TOKEN no configurado");
    }

    const { name, email, totalPrice, orderId, photoCount, plan } = orderData;

    console.log(`💰 PRECIO FINAL MP: $${totalPrice}`);

    const payload = {
      items: [
        {
          title: `Fotoimanes Magnético - ${photoCount} unidades`,
          description: `Pedido ${orderId} - $${totalPrice}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: Math.round(totalPrice),
        },
      ],
      payer: {
        email: email.trim(),
        name: name.trim(),
      },
      back_urls: {
        success: `https://magnetico-fotoimanes.com/success?order=${orderId}&status=approved`,
        failure: `https://magnetico-fotoimanes.com/error?order=${orderId}&status=rejected`,
        pending: `https://magnetico-fotoimanes.com/pending?order=${orderId}&status=pending`,
      },
      auto_return: "approved",
      external_reference: orderId,
      // NOTA: Webhook eliminado - los pagos se confirmarán manualmente o por otro servicio
      expires: false,
      binary_mode: true,
    };

    const response = await axios.post(
      "https://api.mercadopago.com/checkout/preferences",
      payload,
      {
        headers: {
          Authorization: `Bearer ${mpToken}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    return response.data;
  } catch (error) {
    console.error("❌ Error MP:", error.response?.data || error.message);
    throw new Error(`Error al crear pago: ${error.message}`);
  }
};

// 🔥 ENDPOINT PRINCIPAL
router.post("/", upload.array("photos"), async (req, res) => {
  res.header("Access-Control-Allow-Origin", "https://magnetico-fotoimanes.com");

  const orderId = `ORD-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  console.log(`\n🎯 NUEVO PEDIDO: ${orderId}`);
  console.log(`📸 Fotos recibidas: ${req.files?.length || 0}`);

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No se recibieron imágenes",
      });
    }

    const {
      name,
      email,
      phone = "",
      address = "",
      plan = "",
      precio_total = "",
      tipo = "fotoimanes_unitario",
    } = req.body;
    const photos = req.files;
    const photoCount = photos.length;

    // Validaciones
    if (!name?.trim() || !email?.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Nombre y email son obligatorios" });
    }

    if (photoCount < 4) {
      return res.status(400).json({
        success: false,
        error: `Se requieren al menos 4 fotos. Recibiste ${photoCount}`,
      });
    }

    // Cálculo de precio
    const unitPrice = getUnitPrice();
    let totalPrice =
      tipo === "fotoimanes_plan" && precio_total
        ? parseFloat(precio_total)
        : unitPrice * photoCount;

    if (isNaN(totalPrice) || totalPrice <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "Error en el cálculo del precio" });
    }

    // Datos para emails y MP
    const orderData = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      plan: plan,
      photoCount: photoCount,
      unitPrice: unitPrice,
      totalPrice: totalPrice,
      orderId: orderId,
      tipo: tipo,
    };

    // Crear preferencia MP
    const preference = await createMercadoPagoPreference(orderData);
    orderData.mpPreferenceId = preference.id;
    orderData.paymentLink = preference.init_point;

    // 🔥 ENVIAR EMAILS CON FOTOS ADJUNTAS
    sendOrderReceivedEmail(orderData, photos).catch((e) =>
      console.error("Error email pedido:", e.message)
    );
    sendCustomerConfirmationEmail(orderData).catch((e) =>
      console.error("Error email cliente:", e.message)
    );

    // Respuesta exitosa
    res.status(200).json({
      success: true,
      message: "✅ Pedido procesado correctamente",
      orderId: orderData.orderId,
      payment: {
        preference_id: preference.id,
        init_point: preference.init_point,
        total: totalPrice,
      },
      details: {
        photosProcessed: photoCount,
        totalPrice: totalPrice,
        photosAttached: photos.length,
      },
    });

    console.log(
      `🎉 Pedido ${orderId} completado - ${photos.length} fotos adjuntas`
    );
  } catch (error) {
    console.error(`💥 ERROR en ${orderId}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Error interno del servidor",
      orderId: orderId,
    });
  }
});

// Endpoints adicionales
router.get("/config/price", (req, res) => {
  res.header("Access-Control-Allow-Origin", "https://magnetico-fotoimanes.com");
  res.json({
    success: true,
    price: getUnitPrice(),
    unit_price: getUnitPrice(),
    currency: "ARS",
  });
});

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "order-api",
    timestamp: new Date().toISOString(),
  });
});

export default router;
