// -------------------------
// routes/order.js - VERSIÓN CORREGIDA PARA RESEND
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
    fileSize: 3 * 1024 * 1024,
    files: 20,
  }
});

// Precio consistente
const getUnitPrice = () => 2500;

// 🔥 CONFIGURACIÓN DE RESEND
const resend = new Resend(process.env.RESEND_API_KEY);

// 🔥 1. EMAIL DE PEDIDO RECIBIDO (para vos)
const sendOrderReceivedEmail = async (orderData, photos) => {
  try {
    console.log('📧 Intentando enviar email de pedido recibido...');
    
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
            .status { color: #BCA88F; font-weight: bold; }
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
            
            <p><strong>ID de Pago MP:</strong> ${orderData.mpPreferenceId}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}</p>
            <p><em>El pedido está pendiente de pago. Se enviará confirmación cuando se complete el pago.</em></p>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Magnético Fotoimanes <notificaciones@magnetico-fotoimanes.com>',
      to: process.env.ORDER_NOTIFICATION_EMAIL || 'tu-email@gmail.com',
      subject: `📦 Pedido Recibido - ${orderData.orderId} - Pendiente de Pago`,
      html: emailHtml,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log(`✅ Email de pedido recibido enviado: ${orderData.orderId}`);
    
  } catch (error) {
    console.error('❌ Error enviando email de pedido:', error.message);
  }
};

// 🔥 2. EMAIL DE CONFIRMACIÓN AL CLIENTE
const sendCustomerConfirmationEmail = async (orderData) => {
  try {
    console.log('📧 Intentando enviar email al cliente...');
    
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
              <p><strong>Total:</strong> $${orderData.totalPrice}</p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <a href="${orderData.paymentLink}" class="button">
                💳 COMPLETAR PAGO
              </a>
            </div>

            <p><strong>Próximos pasos:</strong></p>
            <ol>
              <li>Completá el pago usando el botón arriba</li>
              <li>Recibirás la confirmación por email</li>
              <li>Procesaremos tu pedido en 24-48 horas</li>
            </ol>

            <p>Si tenés alguna duda, respondé a este email.</p>
            <p>¡Gracias por elegirnos!<br>El equipo de <strong>Magnético</strong></p>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Magnético Fotoimanes <notificaciones@magnetico-fotoimanes.com>',
      to: orderData.email,
      subject: `📦 Confirmación de Pedido - ${orderData.orderId}`,
      html: emailHtml
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log(`✅ Email de confirmación enviado al cliente: ${orderData.orderId}`);
    
  } catch (error) {
    console.error('❌ Error enviando email al cliente:', error.message);
  }
};

// 🔥 3. EMAIL DE PAGO APROBADO (para vos)
const sendPaymentApprovedEmail = async (paymentData) => {
  try {
    console.log('📧 Intentando enviar email de pago aprobado...');
    
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
          </style>
        </head>
        <body>
          <div class="header">
            <h1>✅ PAGO APROBADO</h1>
            <p>Orden: ${paymentData.orderId}</p>
          </div>
          <div class="content">
            <div class="status">🟢 PAGO CONFIRMADO - PROCESAR PEDIDO</div>
            
            <h2>👤 Información del Cliente</h2>
            <p><strong>Nombre:</strong> ${paymentData.customerName}</p>
            <p><strong>Email:</strong> ${paymentData.customerEmail}</p>
            <p><strong>Teléfono:</strong> ${paymentData.customerPhone || 'No proporcionado'}</p>
            <p><strong>Dirección:</strong> ${paymentData.customerAddress || 'No proporcionada'}</p>
            
            <div class="order-details">
              <h2>💰 Información de Pago</h2>
              <p><strong>ID de Pago MP:</strong> ${paymentData.paymentId}</p>
              <p><strong>Monto:</strong> $${paymentData.amount}</p>
              <p><strong>Fecha de pago:</strong> ${new Date(paymentData.date).toLocaleString('es-AR')}</p>
              <p><strong>Método:</strong> ${paymentData.paymentMethod || 'No especificado'}</p>
            </div>

            <div class="order-details">
              <h2>📦 Detalles del Pedido</h2>
              <p><strong>Producto:</strong> ${paymentData.photoCount} Fotoimanes</p>
              <p><strong>Plan:</strong> ${paymentData.plan || 'Unitario'}</p>
              <p><strong>Total:</strong> $${paymentData.amount}</p>
            </div>

            <p><strong>Acción requerida:</strong> Procesar el pedido y preparar envío.</p>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Magnético Fotoimanes <notificaciones@magnetico-fotoimanes.com>',
      to: process.env.ORDER_NOTIFICATION_EMAIL,
      subject: `✅ PAGO APROBADO - ${paymentData.orderId}`,
      html: emailHtml
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log(`✅ Email de pago aprobado enviado: ${paymentData.orderId}`);
    
  } catch (error) {
    console.error('❌ Error enviando email de pago aprobado:', error.message);
  }
};

// 🔥 4. EMAIL DE CONFIRMACIÓN AL CLIENTE (pago aprobado)
const sendCustomerPaymentConfirmation = async (customerData) => {
  try {
    console.log('📧 Intentando enviar confirmación de pago al cliente...');
    
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
          </style>
        </head>
        <body>
          <div class="header">
            <h1>¡Pago Confirmado! 🎉</h1>
            <p>Tu pedido está siendo procesado</p>
          </div>
          <div class="content">
            <h2>Hola ${customerData.name},</h2>
            <p class="status">✅ Tu pago ha sido confirmado exitosamente.</p>
            
            <div class="order-details">
              <h3>📋 Resumen de tu pedido</h3>
              <p><strong>Número de orden:</strong> ${customerData.orderId}</p>
              <p><strong>Producto:</strong> ${customerData.photoCount} Fotoimanes Magnético</p>
              <p><strong>Total pagado:</strong> $${customerData.amount}</p>
              <p><strong>Fecha de pago:</strong> ${new Date(customerData.date).toLocaleString('es-AR')}</p>
            </div>

            <p><strong>¿Qué sigue?</strong></p>
            <ul>
              <li>Estamos procesando tus fotoimanes</li>
              <li>Recibirás una notificación cuando sean enviados</li>
              <li>Tiempo de procesamiento: 24-48 horas</li>
            </ul>

            <p>Si tenés alguna pregunta, no dudes en responder este email.</p>
            
            <p>¡Gracias por tu compra!<br>El equipo de <strong>Magnético</strong></p>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Magnético Fotoimanes <notificaciones@magnetico-fotoimanes.com>',
      to: customerData.email,
      subject: `✅ Pago Confirmado - Pedido ${customerData.orderId}`,
      html: emailHtml
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log(`✅ Email de confirmación de pago enviado al cliente: ${customerData.orderId}`);
    
  } catch (error) {
    console.error('❌ Error enviando confirmación de pago al cliente:', error.message);
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

    const payload = {
      items: [
        {
          title: `Fotoimanes Magnético - ${photoCount} unidades`,
          description: `Pedido ${orderId}`,
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
        success: `https://magnetico-fotoimanes.com/success?order=${orderId}`,
        failure: `https://magnetico-fotoimanes.com/error?order=${orderId}`,
        pending: `https://magnetico-fotoimanes.com/pending?order=${orderId}`,
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

    // 🔥 ENVIAR EMAILS DE PEDIDO RECIBIDO (no bloqueante)
    sendOrderReceivedEmail(orderData, photos).catch(e => console.error('Error email pedido:', e.message));
    sendCustomerConfirmationEmail(orderData).catch(e => console.error('Error email cliente:', e.message));

    // Respuesta exitosa
    res.status(200).json({
      success: true,
      message: "✅ Pedido procesado correctamente",
      orderId: orderId,
      payment: {
        preference_id: preference.id,
        init_point: preference.init_point,
        total: totalPrice,
      },
      details: {
        photosProcessed: photoCount,
        totalPrice: totalPrice
      }
    });

    console.log(`🎉 Pedido ${orderId} procesado - Emails enviados`);

  } catch (error) {
    console.error(`💥 ERROR en ${orderId}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Error interno del servidor",
      orderId: orderId
    });
  }
});

// 🔥 WEBHOOK PARA PAGOS APROBADOS
router.post("/webhook", async (req, res) => {
  console.log('🔔 Webhook MP recibido:', req.query, req.body);
  
  try {
    const { type, data } = req.body;
    
    if (type === "payment") {
      const paymentId = data.id;
      
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
      
      if (payment.status === 'approved') {
        const orderId = payment.external_reference;
        
        console.log(`✅ Pago aprobado: ${paymentId} para orden: ${orderId}`);
        
        // 🔥 ENVIAR EMAILS DE PAGO APROBADO
        const paymentData = {
          orderId: orderId,
          paymentId: paymentId,
          amount: payment.transaction_amount,
          date: payment.date_approved,
          paymentMethod: payment.payment_method_id,
          customerName: payment.payer.first_name + ' ' + payment.payer.last_name,
          customerEmail: payment.payer.email,
          photoCount: 0, // Podrías obtener esto de una base de datos
          plan: 'Unitario' // Podrías obtener esto de una base de datos
        };

        sendPaymentApprovedEmail(paymentData).catch(e => console.error('Error email pago aprobado:', e.message));
        sendCustomerPaymentConfirmation({
          ...paymentData,
          name: payment.payer.first_name + ' ' + payment.payer.last_name,
          email: payment.payer.email
        }).catch(e => console.error('Error email confirmación cliente:', e.message));
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.status(200).send('OK');
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

export default router;