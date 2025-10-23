// -------------------------
// routes/order.js - VERSIÓN DE EMERGENCIA
// -------------------------
import express from "express";
import multer from "multer";
import axios from "axios";

const router = express.Router();

// Configuración simplificada de multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 20,
  },
});

// Precio por defecto (fallback)
const getUnitPrice = () => {
  return 2500; // Precio fijo por emergencia
};

// Función simplificada de Mercado Pago
const createMercadoPagoPreference = async (name, email, totalPrice, orderId) => {
  try {
    const mpToken = process.env.MP_ACCESS_TOKEN;
    
    if (!mpToken) {
      throw new Error('MP_ACCESS_TOKEN no configurado');
    }

    const payload = {
      items: [
        {
          title: `Fotoimanes Magnético - Pedido ${orderId}`,
          description: `Pedido de ${name}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: Math.round(totalPrice),
        },
      ],
      payer: {
        email: email,
        name: name,
      },
      back_urls: {
        success: "https://magnetico-fotoimanes.com/success",
        failure: "https://magnetico-fotoimanes.com/error", 
        pending: "https://magnetico-fotoimanes.com/pending",
      },
      auto_return: "none",
      external_reference: orderId,
      notification_url: "https://magnetico-server-1.onrender.com/api/webhook",
      expires: false,
      binary_mode: true,
    };

    console.log("📦 Creando preferencia MP...");
    
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

    return response.data;
  } catch (error) {
    console.error("❌ Error MP:", error.message);
    throw error;
  }
};

// 🔥 ENDPOINT PRINCIPAL SIMPLIFICADO
router.post("/", upload.array("photos"), async (req, res) => {
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`\n🎯 NUEVO PEDIDO: ${orderId}`);
  console.log(`📸 Fotos: ${req.files?.length || 0}`);
  console.log(`📋 Body keys:`, Object.keys(req.body));

  try {
    // 🔥 EXTRACCIÓN SEGURA DE DATOS
    const { 
      name = "", 
      email = "", 
      phone = "", 
      address = "", 
      plan = "", 
      cantidad = "", 
      precio_total = "", 
      tipo = "fotoimanes_unitario" 
    } = req.body;

    const photos = req.files || [];
    const photoCount = photos.length;

    // 🔥 VALIDACIONES BÁSICAS
    if (!name.trim() || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: "Nombre y email son obligatorios",
      });
    }

    if (photoCount < 4) {
      return res.status(400).json({
        success: false,
        error: "Se requieren al menos 4 fotos",
      });
    }

    // 🔥 CÁLCULO DE PRECIO SIMPLIFICADO
    let totalPrice;
    if (tipo === "fotoimanes_plan" && precio_total) {
      totalPrice = parseFloat(precio_total);
    } else {
      const unitPrice = getUnitPrice();
      totalPrice = unitPrice * photoCount;
    }

    console.log(`💰 Total: $${totalPrice}`);

    // 🔥 CREAR PREFERENCIA MP
    const preference = await createMercadoPagoPreference(
      name.trim(),
      email.trim(),
      totalPrice,
      orderId
    );

    // 🔥 RESPUESTA EXITOSA
    res.status(200).json({
      success: true,
      message: "✅ Pedido procesado correctamente",
      orderId: orderId,
      payment: {
        preference_id: preference.id,
        init_point: preference.init_point,
        total: totalPrice,
      },
      photosProcessed: photoCount,
    });

    console.log(`🎉 Pedido ${orderId} completado`);

  } catch (error) {
    console.error(`💥 ERROR en ${orderId}:`, error.message);
    
    // 🔥 RESPUESTA DE ERROR DETALLADA
    res.status(500).json({
      success: false,
      error: `Error del servidor: ${error.message}`,
      orderId: orderId,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Endpoints adicionales
router.get("/config/price", (req, res) => {
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