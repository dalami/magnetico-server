// -------------------------
// routes/order.js - VERSIÓN COMPLETA CORREGIDA
// -------------------------
import express from "express";
import multer from "multer";
import axios from "axios";
import cors from "cors";
import nodemailer from "nodemailer";

const router = express.Router();

// 🔥 CONFIGURAR CORS
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

// 🔥 PRECIO CONSISTENTE - MISMO QUE FRONTEND
const getUnitPrice = () => {
  return 2500; // EXACTAMENTE EL MISMO PRECIO QUE EN FRONTEND
};

// 🔥 CONFIGURACIÓN DE EMAIL
const createEmailTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// 🔥 FUNCIÓN PARA ENVIAR EMAIL DE PEDIDO
const sendOrderEmail = async (orderData, photos) => {
  try {
    const transporter = createEmailTransporter();
    
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
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎉 Nuevo Pedido Magnético</h1>
            <p>Orden: ${orderData.orderId}</p>
          </div>
          <div class="content">
            <h2>📋 Información del Cliente</h2>
            <p><strong>Nombre:</strong> ${orderData.name}</p>
            <p><strong>Email:</strong> ${orderData.email}</p>
            <p><strong>Teléfono:</strong> ${orderData.phone || 'No proporcionado'}</p>
            <p><strong>Dirección:</strong> ${orderData.address || 'No proporcionada'}</p>
            
            <div class="order-details">
              <h2>📦 Detalles del Pedido</h2>
              <p><strong>Plan:</strong> ${orderData.plan || 'Unitario'}</p>
              <p><strong>Cantidad de fotos:</strong> ${orderData.photoCount}</p>
              <p><strong>Precio unitario:</strong> $${orderData.unitPrice}</p>
              <p class="total">Total: $${orderData.totalPrice}</p>
            </div>
            
            <p><strong>ID de Pago MP:</strong> ${orderData.mpPreferenceId}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}</p>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ORDER_NOTIFICATION_EMAIL || 'tu-email@gmail.com',
      subject: `📦 Nuevo Pedido - ${orderData.orderId}`,
      html: emailHtml,
      attachments: photos.map((photo, index) => ({
        filename: `foto_${index + 1}.jpg`,
        content: photo.buffer,
        contentType: 'image/jpeg'
      }))
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email enviado para orden ${orderData.orderId}`);
    
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    // No lanzamos error para no interrumpir el flujo de pago
  }
};

// 🔥 FUNCIÓN MERCADO PAGO MEJORADA
const createMercadoPagoPreference = async (orderData) => {
  try {
    const mpToken = process.env.MP_ACCESS_TOKEN;
    
    if (!mpToken) {
      throw new Error('MP_ACCESS_TOKEN no configurado');
    }

    const { name, email, totalPrice, orderId, photoCount, plan, unitPrice } = orderData;

    // 🔥 TÍTULO CLARO Y PRECISO
    let title = `${photoCount} Fotoimanes Magnético`;
    let description = `Pedido ${orderId}`;
    
    if (plan) {
      title = `Plan ${plan} - ${photoCount} Fotoimanes`;
      description = `Plan ${plan} - ${photoCount} unidades`;
    }

    // 🔥 VERIFICAR QUE EL PRECIO SEA CORRECTO
    console.log(`💰 Verificación precio MP: $${totalPrice} (${photoCount} × $${unitPrice})`);

    const payload = {
      items: [
        {
          title: title,
          description: description,
          quantity: 1,
          currency_id: "ARS",
          unit_price: Math.round(totalPrice), // 🔥 PRECIO EXACTO
        },
      ],
      payer: {
        email: email.trim(),
        name: name.trim(),
      },
      back_urls: {
        success: `https://magnetico-fotoimanes.com/?order=${orderId}&status=success`,
        failure: `https://magnetico-fotoimanes.com/?order=${orderId}&status=error`,
        pending: `https://magnetico-fotoimanes.com/?order=${orderId}&status=pending`,
      },
      auto_return: "approved",
      external_reference: orderId,
      notification_url: "https://magnetico-server-1.onrender.com/api/webhook",
      expires: false,
      binary_mode: true,
    };

    console.log("📦 Creando preferencia MP con payload:", JSON.stringify(payload, null, 2));
    
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

    console.log("✅ Preferencia MP creada:", response.data.id);
    return response.data;

  } catch (error) {
    console.error("❌ Error MP:", error.response?.data || error.message);
    throw new Error(`Error al crear pago: ${error.message}`);
  }
};

// 🔥 ENDPOINT PRINCIPAL COMPLETO
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

    const { 
      name, 
      email, 
      phone = "", 
      address = "", 
      plan = "", 
      cantidad = "", 
      precio_total = "", 
      tipo = "fotoimanes_unitario" 
    } = req.body;

    const photos = req.files;
    const photoCount = photos.length;

    // 🔥 VALIDACIONES
    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        error: "El nombre es obligatorio",
      });
    }

    if (!email?.trim() || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        success: false,
        error: "El email es obligatorio y debe ser válido",
      });
    }

    if (photoCount < 4) {
      return res.status(400).json({
        success: false,
        error: `Se requieren al menos 4 fotos. Recibiste ${photoCount}`,
      });
    }

    // 🔥 CÁLCULO DE PRECIO CONSISTENTE
    const unitPrice = getUnitPrice();
    let totalPrice;
    
    if (tipo === "fotoimanes_plan" && precio_total) {
      totalPrice = parseFloat(precio_total);
      console.log(`💰 Usando precio de plan: $${totalPrice}`);
    } else {
      totalPrice = unitPrice * photoCount;
      console.log(`💰 Calculando precio unitario: ${photoCount} × $${unitPrice} = $${totalPrice}`);
    }

    // 🔥 VERIFICACIÓN CRÍTICA DEL PRECIO
    if (isNaN(totalPrice) || totalPrice <= 0) {
      console.error('❌ Precio inválido calculado:', totalPrice);
      return res.status(400).json({
        success: false,
        error: "Error en el cálculo del precio",
      });
    }

    // 🔥 DATOS PARA MERCADO PAGO
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

    // 🔥 CREAR PREFERENCIA MP
    const preference = await createMercadoPagoPreference(orderData);

    // 🔥 ENVIAR EMAIL EN SEGUNDO PLANO (no bloquea la respuesta)
    sendOrderEmail({
      ...orderData,
      mpPreferenceId: preference.id
    }, photos).catch(emailError => {
      console.error('❌ Error no crítico en email:', emailError);
    });

    // 🔥 RESPUESTA EXITOSA
    const responseData = {
      success: true,
      message: "✅ Pedido procesado correctamente",
      orderId: orderId,
      payment: {
        preference_id: preference.id,
        init_point: preference.init_point,
        sandbox_init_point: preference.sandbox_init_point,
        total: totalPrice, // 🔥 MISMO PRECIO QUE SE MUESTRA AL USUARIO
        currency: "ARS",
        items: [
          {
            title: `${photoCount} Fotoimanes Magnético`,
            quantity: 1,
            unit_price: totalPrice,
            total: totalPrice
          }
        ]
      },
      details: {
        photosProcessed: photoCount,
        plan: plan || 'unitario',
        unitPrice: unitPrice,
        totalPrice: totalPrice
      }
    };

    console.log(`🎉 Pedido ${orderId} completado - Total: $${totalPrice}`);
    res.status(200).json(responseData);

  } catch (error) {
    console.error(`💥 ERROR en ${orderId}:`, error.message);
    
    res.status(500).json({
      success: false,
      error: error.message || "Error interno del servidor",
      orderId: orderId
    });
  }
});

// 🔥 WEBHOOK PARA PROCESAR PAGOS EXITOSOS
router.post("/webhook", async (req, res) => {
  console.log('🔔 Webhook MP recibido:', req.body);
  
  try {
    const { type, data } = req.body;
    
    if (type === "payment") {
      const paymentId = data.id;
      
      // Obtener detalles del pago de MP
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
      
      if (payment.status === 'approved') {
        console.log(`✅ Pago aprobado para orden: ${orderId}`);
        
        // Aquí podrías enviar otro email de confirmación de pago
        // o actualizar el estado de la orden en una base de datos
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.status(200).send('OK'); // Siempre responder OK a MP
  }
});

// Endpoints adicionales
router.get("/config/price", (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://magnetico-fotoimanes.com');
  
  res.json({
    success: true,
    price: getUnitPrice(),
    unit_price: getUnitPrice(), // 🔥 MISMO PRECIO
    currency: "ARS",
    timestamp: new Date().toISOString()
  });
});

export default router;