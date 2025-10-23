// -------------------------
// routes/order.js - VERSIÓN COMPLETA FUNCIONAL
// -------------------------
import express from "express";
import multer from "multer";
import axios from "axios";
import cors from "cors";
import { Resend } from 'resend';

const router = express.Router();

// Configurar CORS
router.use(cors({
  origin: ['https://magnetico-fotoimanes.com', 'https://www.magnetico-fotoimanes.com'],
  credentials: true
}));

// Configuración de multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 20,
  }
});

// Precio corregido
const getUnitPrice = () => 4000;

// 🔥 CONFIGURACIÓN DE RESEND 
let resend;
try {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY no configurada. Los emails no se enviarán.');
  } else {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend configurado correctamente');
  }
} catch (error) {
  console.error('❌ Error configurando Resend:', error.message);
}

// 🔥 1. EMAIL DE PEDIDO RECIBIDO CON FOTOS ADJUNTAS
const sendOrderReceivedEmail = async (orderData, photos) => {
  try {
    if (!resend) {
      console.log('📧 Resend no configurado - Simulando envío de email');
      console.log('📋 Datos del pedido:', orderData);
      return true;
    }

    console.log('📧 Enviando email con fotos adjuntas...');
    
    // 🔥 PREPARAR ATTACHMENTS
    const attachments = photos.map((photo, index) => ({
      filename: `foto_${index + 1}.jpg`,
      content: photo.buffer.toString('base64'),
      contentType: 'image/jpeg'
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
            <p><strong>Teléfono:</strong> ${orderData.phone || 'No proporcionado'}</p>
            <p><strong>Dirección:</strong> ${orderData.address || 'No proporcionada'}</p>
            
            <div class="order-details">
              <h2>📸 Detalles del Pedido</h2>
              <p><strong>Plan:</strong> ${orderData.plan || 'Unitario'}</p>
              <p><strong>Cantidad de fotos:</strong> ${orderData.photoCount}</p>
              <p><strong>Precio unitario:</strong> $${orderData.unitPrice}</p>
              <p class="total">Total: $${orderData.totalPrice}</p>
            </div>

            <div class="photos-details">
              <h2>🖼️ Fotos Adjuntas (${photos.length})</h2>
              <p><strong>✅ Las fotos están adjuntas a este email y listas para descargar.</strong></p>
              <div style="background: white; padding: 10px; border-radius: 5px; margin: 10px 0;">
                ${photos.map((photo, index) => 
                  `<div class="photo-item">
                    <strong>Foto ${index + 1}:</strong> ${photo.originalname} (${Math.round(photo.size / 1024)} KB)
                   </div>`
                ).join('')}
              </div>
              <p><em>💡 Todas las fotos están comprimidas y listas para producción.</em></p>
            </div>
            
            <p><strong>ID de Pago MP:</strong> ${orderData.mpPreferenceId}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}</p>
            <p><em>El pedido está pendiente de pago. Se enviará confirmación cuando se complete el pago.</em></p>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Magnético Fotoimanes <pedidos@magnetico-fotoimanes.com>',
      to: 'pedidos@magnetico-fotoimanes.com',
      subject: `📦 Pedido ${orderData.orderId} - ${orderData.photoCount} Fotos - $${orderData.totalPrice}`,
      html: emailHtml,
      attachments: attachments
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log(`✅ Email con ${attachments.length} fotos adjuntas enviado correctamente`);
    return true;
    
  } catch (error) {
    console.error('❌ Error enviando email con adjuntos:', error.message);
    return false;
  }
};

// 🔥 2. EMAIL DE CONFIRMACIÓN AL CLIENTE (SIN ADJUNTOS)
const sendCustomerConfirmationEmail = async (orderData) => {
  try {
    if (!resend) {
      console.log('📧 Resend no configurado - Simulando envío al cliente');
      return true;
    }

    console.log('📧 Enviando email al cliente...');
    
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
      from: 'Magnético Fotoimanes <pedidos@magnetico-fotoimanes.com>',
      to: orderData.email,
      subject: `📦 Confirmación de Pedido - ${orderData.orderId} - $${orderData.totalPrice}`,
      html: emailHtml
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log(`✅ Email enviado al cliente: $${orderData.totalPrice}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error enviando email al cliente:', error.message);
    return false;
  }
};

// 🔥 3. EMAIL DE PAGO APROBADO (para vos)
const sendPaymentApprovedEmail = async (paymentData) => {
  try {
    if (!resend) {
      console.log('📧 Resend no configurado - Simulando email de pago aprobado');
      console.log('💰 Pago aprobado:', paymentData);
      return true;
    }

    console.log('📧 Enviando email de pago aprobado...');
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .order-details { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .status { color: #4CAF50; font-weight: bold; font-size: 1.2em; }
            .celebrate { background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>✅ PAGO APROBADO</h1>
            <p>Orden: ${paymentData.orderId}</p>
          </div>
          <div class="content">
            <div class="celebrate">
              <h2>🎉 ¡PAGO CONFIRMADO!</h2>
              <p style="font-size: 1.1em; margin: 10px 0;">El pedido está listo para procesar y enviar</p>
            </div>
            
            <div class="status">🟢 PAGO CONFIRMADO - PROCESAR PEDIDO</div>
            
            <h2>👤 Información del Cliente</h2>
            <p><strong>Nombre:</strong> ${paymentData.customerName}</p>
            <p><strong>Email:</strong> ${paymentData.customerEmail}</p>
            <p><strong>Teléfono:</strong> ${paymentData.customerPhone}</p>
            <p><strong>Dirección:</strong> ${paymentData.customerAddress}</p>
            
            <div class="order-details">
              <h2>💰 Información de Pago</h2>
              <p><strong>ID de Pago MP:</strong> ${paymentData.paymentId}</p>
              <p><strong>Monto:</strong> $${paymentData.amount}</p>
              <p><strong>Fecha de pago:</strong> ${new Date(paymentData.date).toLocaleString('es-AR')}</p>
              <p><strong>Método:</strong> ${paymentData.paymentMethod || 'No especificado'}</p>
            </div>

            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <h3>📦 Acción Requerida</h3>
              <p><strong>Procesar el pedido y preparar envío.</strong></p>
              <p>Orden: <strong>${paymentData.orderId}</strong></p>
            </div>

            <p style="text-align: center; margin-top: 25px; color: #666;">
              <em>Este es un email automático de confirmación de pago.</em>
            </p>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Magnético Fotoimanes <pedidos@magnetico-fotoimanes.com>',
      to: 'pedidos@magnetico-fotoimanes.com',
      subject: `✅ PAGO APROBADO - ${paymentData.orderId} - $${paymentData.amount}`,
      html: emailHtml
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log(`✅ Email de pago aprobado enviado: ${paymentData.orderId}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error enviando email de pago aprobado:', error.message);
    return false;
  }
};

// 🔥 4. EMAIL DE CONFIRMACIÓN AL CLIENTE (pago aprobado)
const sendCustomerPaymentConfirmation = async (customerData) => {
  try {
    if (!resend) {
      console.log('📧 Resend no configurado - Simulando email al cliente');
      return true;
    }

    console.log('📧 Enviando confirmación de pago al cliente...');
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .order-details { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .status { color: #4CAF50; font-weight: bold; }
            .celebrate { background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>¡Pago Confirmado! 🎉</h1>
            <p>Tu pedido está siendo procesado</p>
          </div>
          <div class="content">
            <div class="celebrate">
              <h2>¡Gracias por tu compra!</h2>
              <p style="font-size: 1.1em; margin: 10px 0;">Tu pago ha sido confirmado exitosamente</p>
            </div>
            
            <h2>Hola ${customerData.customerName},</h2>
            <p class="status">✅ Tu pago ha sido confirmado exitosamente.</p>
            
            <div class="order-details">
              <h3>📋 Resumen de tu pedido</h3>
              <p><strong>Número de orden:</strong> ${customerData.orderId}</p>
              <p><strong>ID de pago:</strong> ${customerData.paymentId}</p>
              <p><strong>Total pagado:</strong> $${customerData.amount}</p>
              <p><strong>Fecha de pago:</strong> ${new Date(customerData.date).toLocaleString('es-AR')}</p>
              <p><strong>Método de pago:</strong> ${customerData.paymentMethod || 'Tarjeta'}</p>
            </div>

            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>📦 Estado de tu pedido</h3>
              <p><strong>Estado:</strong> <span style="color: #4CAF50; font-weight: bold;">✅ PAGO CONFIRMADO - EN PROCESAMIENTO</span></p>
              <p>Estamos preparando tus fotoimanes con mucho cuidado.</p>
            </div>

            <p><strong>¿Qué sigue?</strong></p>
            <ul>
              <li>Estamos procesando tus fotoimanes</li>
              <li>Recibirás una notificación cuando sean enviados</li>
              <li>Tiempo de procesamiento: 24-48 horas</li>
              <li>Te contactaremos para coordinar el envío</li>
            </ul>

            <p>Si tenés alguna pregunta, respondé a este email.</p>
            
            <p>¡Gracias por confiar en nosotros!<br>El equipo de <strong>Magnético Fotoimanes</strong></p>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Magnético Fotoimanes <pedidos@magnetico-fotoimanes.com>',
      to: customerData.customerEmail,
      subject: `✅ Pago Confirmado - Pedido ${customerData.orderId}`,
      html: emailHtml
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log(`✅ Email de confirmación de pago enviado al cliente: ${customerData.orderId}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error enviando confirmación de pago al cliente:', error.message);
    return false;
  }
};

// 🔥 FUNCIÓN MERCADO PAGO
const createMercadoPagoPreference = async (orderData) => {
  try {
    const mpToken = process.env.MP_ACCESS_TOKEN;
    
    if (!mpToken) {
      throw new Error('MP_ACCESS_TOKEN no configurado');
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
        success: `https://magnetico-fotoimanes.com/?payment=success&order=${orderId}`,
        failure: `https://magnetico-fotoimanes.com/?payment=error&order=${orderId}`,
        pending: `https://magnetico-fotoimanes.com/?payment=pending&order=${orderId}`,
      },
      auto_return: "approved",
      external_reference: orderId,
      notification_url: "https://magnetico-server-1.onrender.com/api/webhook",
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

// 🔥 WEBHOOK PARA PAGOS APROBADOS
// 🔥 WEBHOOK CON LOGS DETALLADOS
router.post("/webhook", express.json(), async (req, res) => {
  console.log('🔔🔔🔔 WEBHOOK LLAMADO - INICIO 🔔🔔🔔');
  console.log('📋 HEADERS:', req.headers);
  console.log('📦 BODY COMPLETO:', JSON.stringify(req.body, null, 2));
  console.log('🔔🔔🔔 WEBHOOK LLAMADO - FIN 🔔🔔🔔');
  
  try {
    const { type, data } = req.body;
    
    if (!type) {
      console.log('❌ Webhook sin tipo - posible llamada de prueba');
      return res.status(200).send('OK');
    }
    
    console.log(`🎯 Tipo de webhook: ${type}`);
    
    if (type === "payment") {
      const paymentId = data.id;
      console.log(`💰 Procesando pago: ${paymentId}`);
      
      // Obtener detalles del pago
      const response = await axios.get(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`
          }
        }
      );
      
      const payment = response.data;
      const orderId = payment.external_reference;
      
      console.log(`📋 Estado del pago ${paymentId}: ${payment.status}`);
      console.log(`📦 Orden asociada: ${orderId}`);
      
      if (payment.status === 'approved') {
        console.log(`✅✅✅ PAGO APROBADO DETECTADO ✅✅✅`);
        
        const paymentData = {
          orderId: orderId,
          paymentId: paymentId,
          amount: payment.transaction_amount,
          date: payment.date_approved,
          paymentMethod: payment.payment_method_id,
          customerName: `${payment.payer.first_name} ${payment.payer.last_name}`,
          customerEmail: payment.payer.email,
          customerPhone: payment.payer.phone?.number || 'No proporcionado',
          customerAddress: `${payment.payer.address?.street_name || ''} ${payment.payer.address?.street_number || ''}`.trim() || 'No proporcionada'
        };

        console.log('📧📧📧 INICIANDO ENVÍO DE EMAILS 📧📧📧');
        
        // Email para vos
        const result1 = await sendPaymentApprovedEmail(paymentData);
        console.log(`📧 Email a pedidos@: ${result1 ? '✅' : '❌'}`);
        
        // Email para el cliente
        const result2 = await sendCustomerPaymentConfirmation(paymentData);
        console.log(`📧 Email al cliente: ${result2 ? '✅' : '❌'}`);
        
        console.log(`🎉🎉🎉 PROCESO COMPLETADO - Emails enviados 🎉🎉🎉`);
        
      } else {
        console.log(`ℹ️ Pago ${paymentId} con estado: ${payment.status}`);
      }
    } else {
      console.log(`📨 Webhook de tipo no manejado: ${type}`);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('💥💥💥 ERROR CRÍTICO EN WEBHOOK:', error.message);
    console.error('Stack:', error.stack);
    res.status(200).send('OK');
  }
});

// 🔥 ENDPOINT PRINCIPAL
router.post("/", upload.array("photos"), async (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://magnetico-fotoimanes.com');
  
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`\n🎯 NUEVO PEDIDO: ${orderId}`);
  console.log(`📸 Fotos recibidas: ${req.files?.length || 0}`);

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No se recibieron imágenes",
      });
    }

    const { name, email, phone = "", address = "", plan = "", precio_total = "", tipo = "fotoimanes_unitario" } = req.body;
    const photos = req.files;
    const photoCount = photos.length;

    // Validaciones
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ success: false, error: "Nombre y email son obligatorios" });
    }

    if (photoCount < 4) {
      return res.status(400).json({ 
        success: false, 
        error: `Se requieren al menos 4 fotos. Recibiste ${photoCount}` 
      });
    }

    // Cálculo de precio
    const unitPrice = getUnitPrice();
    let totalPrice = tipo === "fotoimanes_plan" && precio_total ? parseFloat(precio_total) : unitPrice * photoCount;

    if (isNaN(totalPrice) || totalPrice <= 0) {
      return res.status(400).json({ success: false, error: "Error en el cálculo del precio" });
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
      tipo: tipo
    };

    // Crear preferencia MP
    const preference = await createMercadoPagoPreference(orderData);
    orderData.mpPreferenceId = preference.id;
    orderData.paymentLink = preference.init_point;

    // 🔥 ENVIAR EMAILS CON FOTOS ADJUNTAS
    sendOrderReceivedEmail(orderData, photos).catch(e => console.error('Error email pedido:', e.message));
    sendCustomerConfirmationEmail(orderData).catch(e => console.error('Error email cliente:', e.message));

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
        photosAttached: photos.length
      }
    });

    console.log(`🎉 Pedido ${orderId} completado - ${photos.length} fotos adjuntas`);

  } catch (error) {
    console.error(`💥 ERROR en ${orderId}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Error interno del servidor",
      orderId: orderId
    });
  }
});

// Endpoints adicionales
router.get("/config/price", (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://magnetico-fotoimanes.com');
  res.json({
    success: true,
    price: getUnitPrice(),
    unit_price: getUnitPrice(),
    currency: "ARS"
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