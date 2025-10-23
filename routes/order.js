// -------------------------
// routes/order.js - VERSIÓN CORREGIDA
// -------------------------
import express from "express";
import multer from "multer";
import axios from "axios";
import cors from "cors";

const router = express.Router();

// 🔥 CONFIGURAR CORS ESPECÍFICO PARA ESTA RUTA
router.use(cors({
  origin: ['https://magnetico-fotoimanes.com', 'https://www.magnetico-fotoimanes.com'],
  credentials: true
}));

// Configuración de multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
    files: 20,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

// Manejo de errores de multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'La imagen es demasiado grande. Máximo 3MB por imagen.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Máximo 20 imágenes permitidas.'
      });
    }
  }
  next(error);
};

// Precio por defecto
const getUnitPrice = () => 2500;

// Función Mercado Pago mejorada
const createMercadoPagoPreference = async (name, email, totalPrice, orderId, photoCount, plan = null) => {
  try {
    const mpToken = process.env.MP_ACCESS_TOKEN;
    
    if (!mpToken) {
      console.error('❌ MP_ACCESS_TOKEN no configurado');
      throw new Error('Error de configuración del servicio de pago');
    }

    let title = `Fotoimanes Magnético - ${photoCount} foto${photoCount > 1 ? 's' : ''}`;
    if (plan) {
      title = `Plan ${plan} - ${photoCount} Fotoimanes Magnético`;
    }

    const payload = {
      items: [
        {
          title: title,
          description: `Pedido ${orderId} de ${name}`,
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
        success: "https://magnetico-fotoimanes.com/success",
        failure: "https://magnetico-fotoimanes.com/error",
        pending: "https://magnetico-fotoimanes.com/pending",
      },
      auto_return: "approved",
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

// 🔥 ENDPOINT PRINCIPAL MEJORADO
router.post("/", upload.array("photos"), handleMulterError, async (req, res) => {
  // 🔥 HEADERS CORS EXPLÍCITOS
  res.header('Access-Control-Allow-Origin', 'https://magnetico-fotoimanes.com');
  res.header('Access-Control-Allow-Methods', 'POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`\n🎯 NUEVO PEDIDO: ${orderId}`);
  console.log(`📸 Fotos recibidas: ${req.files?.length || 0}`);
  console.log(`📋 Datos:`, {
    name: req.body.name?.substring(0, 20) + '...',
    email: req.body.email,
    plan: req.body.plan || 'unitario',
    photoCount: req.files?.length || 0
  });

  try {
    // Validar que hay archivos
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

    // 🔥 VALIDACIONES MEJORADAS
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

    if (photoCount > 20) {
      return res.status(400).json({
        success: false,
        error: `Máximo 20 fotos permitidas. Recibiste ${photoCount}`,
      });
    }

    // 🔥 CÁLCULO DE PRECIO
    let totalPrice;
    if (tipo === "fotoimanes_plan" && precio_total) {
      totalPrice = parseFloat(precio_total);
    } else {
      const unitPrice = getUnitPrice();
      totalPrice = unitPrice * photoCount;
    }

    // Validar precio
    if (isNaN(totalPrice) || totalPrice <= 0) {
      return res.status(400).json({
        success: false,
        error: "El precio calculado no es válido",
      });
    }

    console.log(`💰 Precio calculado: $${totalPrice}`);

    // 🔥 CREAR PREFERENCIA MP
    const preference = await createMercadoPagoPreference(
      name,
      email,
      totalPrice,
      orderId,
      photoCount,
      plan
    );

    // 🔥 RESPUESTA EXITOSA
    const responseData = {
      success: true,
      message: "✅ Pedido procesado correctamente",
      orderId: orderId,
      payment: {
        preference_id: preference.id,
        init_point: preference.init_point,
        sandbox_init_point: preference.sandbox_init_point,
        total: totalPrice,
      },
      details: {
        photosProcessed: photoCount,
        plan: plan || 'unitario',
        customer: name.substring(0, 3) + '...'
      }
    };

    console.log(`🎉 Pedido ${orderId} completado exitosamente`);
    res.status(200).json(responseData);

  } catch (error) {
    console.error(`💥 ERROR en ${orderId}:`, error.message);
    
    // 🔥 RESPUESTA DE ERROR MEJORADA
    const errorResponse = {
      success: false,
      error: error.message || "Error interno del servidor",
      orderId: orderId,
      timestamp: new Date().toISOString()
    };

    // Agregar detalles de debug solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      errorResponse.debug = {
        stack: error.stack,
        photosReceived: req.files?.length || 0
      };
    }

    res.status(500).json(errorResponse);
  }
});

// Endpoints adicionales
router.get("/config/price", (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://magnetico-fotoimanes.com');
  
  res.json({
    success: true,
    price: getUnitPrice(),
    unit_price: getUnitPrice(),
    currency: "ARS",
    timestamp: new Date().toISOString()
  });
});

router.get("/health", (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://magnetico-fotoimanes.com');
  
  res.json({
    status: "ok",
    service: "order-api",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Manejo global de errores
router.use((error, req, res, next) => {
  console.error('💥 Error global:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

export default router;