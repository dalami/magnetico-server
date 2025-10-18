// -------------------------
// routes/order.js - VERSIÓN CON FOTOS ADJUNTAS
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
    fileSize: 5 * 1024 * 1024, // Reducido a 5MB por foto
    files: 20,
    fieldSize: 10 * 1024 * 1024
  }
});

// ------------------------------
// 📧 Servicio de Email al Vendedor CON FOTOS ADJUNTAS
// ------------------------------
const sendVendorEmailWithAttachments = async ({ name, email, phone, address, photos, orderId }) => {
  try {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    
    if (!emailUser || !emailPass) {
      console.log('❌ No hay configuración de email para adjuntar fotos');
      return { error: 'No hay configuración de email', simulated: true };
    }

    console.log('📧 Preparando email con fotos adjuntas...');

    // 🔥 CONFIGURACIÓN OPTIMIZADA PARA RENDER
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587, // Puerto alternativo que funciona mejor en Render
      secure: false,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      connectionTimeout: 30000, // Aumentado a 30 segundos
      greetingTimeout: 30000,
      socketTimeout: 30000,
      // Configuración adicional para Render
      tls: {
        rejectUnauthorized: false
      }
    });

    // 🔥 PREPARAR ADJUNTOS (máximo 10 fotos para evitar timeout)
    const attachments = photos.slice(0, 10).map((file, index) => {
      // Optimizar el nombre del archivo
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
      return {
        filename: `Foto_${index + 1}_${orderId}_${safeName}`,
        content: file.buffer,
        contentType: file.mimetype,
        encoding: 'base64'
      };
    });

    console.log(`📎 Preparados ${attachments.length} adjuntos de ${photos.length} fotos totales`);

    const vendorHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50; text-align: center;">🎉 NUEVO PEDIDO - ${photos.length} FOTOS</h2>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 15px 0;">
          <h3 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">📋 Datos del Cliente</h3>
          <p><strong>Nombre:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          ${phone ? `<p><strong>Teléfono:</strong> <a href="tel:${phone}">${phone}</a></p>` : ''}
          ${address ? `<p><strong>Dirección:</strong> ${address}</p>` : ''}
          <p><strong>Total de Fotos:</strong> ${photos.length}</p>
          <p><strong>Adjuntadas:</strong> ${attachments.length} (máximo 10 para evitar timeout)</p>
          <p><strong>ID de Pedido:</strong> ${orderId}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}</p>
        </div>

        <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; border: 1px solid #c3e6cb; margin: 15px 0;">
          <p style="margin: 0; color: #155724;">
            <strong>📞 Contactá al cliente:</strong> 
            <a href="mailto:${email}" style="color: #155724; text-decoration: underline;">${email}</a>
            ${phone ? ` o <a href="tel:${phone}" style="color: #155724; text-decoration: underline;">${phone}</a>` : ''}
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 14px;">
            <em>Las ${attachments.length} fotos están adjuntas a este email</em>
          </p>
        </div>
      </div>
    `;

    console.log('🔄 Enviando email con adjuntos...');
    
    const vendorResult = await transporter.sendMail({
      from: `"Magnético" <${emailUser}>`,
      to: process.env.DESTINATION_EMAIL || emailUser,
      replyTo: email,
      subject: `📦 PEDIDO CON ${photos.length} FOTOS - ${orderId}`,
      html: vendorHtml,
      attachments: attachments,
      // Prioridad alta
      priority: 'high'
    });

    console.log(`✅ Email con ${attachments.length} fotos adjuntas enviado exitosamente`);
    return { 
      success: true, 
      provider: 'gmail', 
      photosAttached: attachments.length,
      totalPhotos: photos.length,
      messageId: vendorResult.messageId 
    };

  } catch (error) {
    console.error('❌ Error enviando email con adjuntos:', error.message);
    
    // 🔥 FALLBACK: Enviar email sin adjuntos pero con la información
    try {
      console.log('🔄 Intentando fallback: email sin adjuntos...');
      return await sendVendorEmailFallback({ name, email, phone, address, photos, orderId });
    } catch (fallbackError) {
      console.error('❌ Fallback también falló:', fallbackError.message);
      return { error: error.message, simulated: true };
    }
  }
};

// 🔥 FALLBACK: Email sin adjuntos pero con información
const sendVendorEmailFallback = async ({ name, email, phone, address, photos, orderId }) => {
  try {
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    
    if (SENDGRID_API_KEY) {
      console.log('📧 Enviando email informativo (fallback)...');
      
      const emailData = {
        personalizations: [
          {
            to: [{ email: process.env.DESTINATION_EMAIL }],
            subject: `📦 PEDIDO: ${photos.length} FOTOS - ${orderId}`
          }
        ],
        from: { email: 'notificaciones@magnetico.com', name: 'Magnético' },
        content: [
          {
            type: 'text/html',
            value: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4CAF50; text-align: center;">🎉 NUEVO PEDIDO - ${photos.length} FOTOS</h2>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 15px 0;">
                  <h3 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">📋 Datos del Cliente</h3>
                  <p><strong>Nombre:</strong> ${name}</p>
                  <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                  ${phone ? `<p><strong>Teléfono:</strong> <a href="tel:${phone}">${phone}</a></p>` : ''}
                  ${address ? `<p><strong>Dirección:</strong> ${address}</p>` : ''}
                  <p><strong>Total de Fotos:</strong> ${photos.length}</p>
                  <p><strong>ID de Pedido:</strong> ${orderId}</p>
                  <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}</p>
                </div>

                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border: 1px solid #ffeaa7; margin: 15px 0;">
                  <h4 style="color: #856404; margin-top: 0;">📸 Fotos del Pedido</h4>
                  <p><strong>Total de fotos:</strong> ${photos.length}</p>
                  <p><strong>Tamaños aproximados:</strong></p>
                  <ul>
                    ${photos.map((photo, index) => `
                      <li>Foto ${index + 1}: ${(photo.size / 1024 / 1024).toFixed(2)} MB - ${photo.originalname}</li>
                    `).join('')}
                  </ul>
                  <p style="color: #856404; font-style: italic; margin-bottom: 0;">
                    ⚠️ Las fotos no pudieron adjuntarse por limitaciones técnicas. 
                    Contactá al cliente para que te las envíe directamente.
                  </p>
                </div>

                <div style="margin-top: 20px; padding: 15px; background: #e8f5e8; border-radius: 8px; border: 1px solid #c3e6cb;">
                  <p style="margin: 0; color: #155724;">
                    <strong>📞 Contactá al cliente:</strong> 
                    <a href="mailto:${email}" style="color: #155724; text-decoration: underline;">${email}</a>
                    ${phone ? ` o <a href="tel:${phone}" style="color: #155724; text-decoration: underline;">${phone}</a>` : ''}
                  </p>
                </div>
              </div>
            `
          }
        ]
      };

      await axios.post(
        'https://api.sendgrid.com/v3/mail/send',
        emailData,
        {
          headers: {
            'Authorization': `Bearer ${SENDGRID_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log('✅ Email informativo enviado (fallback)');
      return { success: true, provider: 'sendgrid-fallback', photosAttached: 0 };
    }

    console.log('ℹ️ No hay configuración de email disponible para fallback');
    return { simulated: true };

  } catch (error) {
    console.error('❌ Error en fallback:', error.message);
    return { error: error.message, simulated: true };
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
// 🔄 PROCESAMIENTO EN SEGUNDO PLANO CON FOTOS
// ------------------------------
async function processEmailBackground({ name, email, phone, address, photos, orderId }) {
  try {
    console.log(`🔄 Procesando email CON FOTOS para ${orderId}...`);
    
    // Intentar enviar email con fotos adjuntas
    const emailResult = await sendVendorEmailWithAttachments({
      name, email, phone, address, photos, orderId
    });

    if (emailResult.error) {
      console.log(`⚠️ Email con fotos falló: ${emailResult.error}`);
    } else if (emailResult.success) {
      console.log(`✅ Email procesado: ${emailResult.photosAttached}/${photos.length} fotos adjuntas`);
    }

  } catch (error) {
    console.error(`❌ Error en procesamiento de email ${orderId}:`, error);
  }
}

// ------------------------------
// 🚀 ENDPOINT PRINCIPAL - CON FOTOS ADJUNTAS
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
    console.log(`🌐 Origen: ${req.get('origin')}`);

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

    if (!preference.init_point) {
      throw new Error("No se recibió link de pago de Mercado Pago");
    }

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

    // 🔥 PROCESAR EMAIL CON FOTOS EN SEGUNDO PLANO (no bloqueante)
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

// ------------------------------
// 📊 ENDPOINT PARA OBTENER PRECIO
// ------------------------------
router.get("/config/price", async (req, res) => {
  try {
    const unitPrice = getUnitPrice();
    
    res.json({
      success: true,
      price: unitPrice,
      unit_price: unitPrice,
      currency: "ARS",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Error obteniendo precio:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener el precio"
    });
  }
});

// ------------------------------
// 🩺 HEALTH CHECK
// ------------------------------
router.get("/health", (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'order-api',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

export default router;