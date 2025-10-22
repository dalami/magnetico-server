// -------------------------
// routes/admin.js - PRODUCTION READY (CON PERSISTENCIA)
// -------------------------
import express from "express";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";
import { 
  getUnitPrice, 
  setRuntimeUnitPrice, 
  setPermanentPrice  // 👈 NUEVA IMPORTACIÓN
} from "../services/pricing.js";

const router = express.Router();

// -------------------------
// 🔐 Rate Limiting estricto para admin
// -------------------------
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // máximo 30 requests por ventana
  message: {
    error: "Demasiadas solicitudes administrativas.",
    retry_after: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// -------------------------
// 🛡️ Middleware de protección mejorado
// -------------------------
function adminOnly(req, res, next) {
  const startTime = Date.now();
  const requestId = `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Log de intento de acceso
  console.log(`🔐 [${requestId}] Intento de acceso admin desde:`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')?.substring(0, 50) || 'unknown',
    endpoint: req.originalUrl
  });

  // Verificar configuración del servidor
  if (!process.env.ADMIN_KEY) {
    console.error(`❌ [${requestId}] ADMIN_KEY no configurado en entorno`);
    return res.status(500).json({ 
      error: "Configuración incompleta del servidor",
      code: "ADMIN_KEY_MISSING"
    });
  }

  const key = req.headers["x-admin-key"];
  
  // Verificar header de autenticación
  if (!key) {
    console.warn(`🚫 [${requestId}] Intento sin clave admin`);
    return res.status(401).json({ 
      error: "Clave de administrador requerida",
      code: "ADMIN_KEY_REQUIRED"
    });
  }

  // Verificar validez de la clave
  if (key !== process.env.ADMIN_KEY) {
    console.warn(`🚫 [${requestId}] Intento con clave inválida desde IP: ${req.ip}`);
    
    // Pequeño delay para prevenir timing attacks
    const processingTime = Date.now() - startTime;
    const remainingTime = Math.max(200 - processingTime, 0);
    
    setTimeout(() => {
      res.status(403).json({ 
        error: "Acceso denegado",
        code: "INVALID_ADMIN_KEY"
      });
    }, remainingTime);
    
    return;
  }

  // Autenticación exitosa
  console.log(`✅ [${requestId}] Acceso admin autorizado`);
  req.adminRequestId = requestId;
  next();
}

// -------------------------
// 📝 Validaciones para actualización de precio
// -------------------------
const priceValidation = [
  body('unit_price')
    .isFloat({ min: 1, max: 1000000 })
    .withMessage('El precio debe ser un número entre 1 y 1,000,000')
    .custom((value, { req }) => {
      // Validar que no sea un cambio extremo (más del 50%)
      const currentPrice = getUnitPrice();
      const newPrice = parseFloat(value);
      const changePercent = Math.abs((newPrice - currentPrice) / currentPrice) * 100;
      
      if (changePercent > 50) {
        throw new Error(`Cambio de precio muy grande (${changePercent.toFixed(1)}%). Verifica el valor.`);
      }
      
      return true;
    })
];

// -------------------------
// 🆕 ENDPOINT NUEVO: POST /api/admin/price/permanent
// -------------------------
router.post("/price/permanent", 
  adminLimiter, 
  adminOnly, 
  priceValidation,
  async (req, res) => {
    try {
      // Validar resultados de express-validator
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Datos de entrada inválidos",
          details: errors.array(),
          request_id: req.adminRequestId
        });
      }

      const newPrice = Number(req.body.unit_price);
      const oldPrice = getUnitPrice();
      
      console.log(`💰 [${req.adminRequestId}] Actualizando precio PERMANENTE: $${oldPrice} → $${newPrice}`);

      // Actualizar precio PERMANENTEMENTE
      const result = await setPermanentPrice(newPrice);
      
      // Log del cambio permanente
      console.log(`✅ [${req.adminRequestId}] Precio actualizado PERMANENTEMENTE: $${result.newPrice}`);
      
      res.json({
        success: true,
        message: "Precio actualizado PERMANENTEMENTE",
        data: {
          previous_price: oldPrice,
          new_price: result.newPrice,
          change_percent: result.changePercent,
          currency_id: "ARS",
          updated_at: result.timestamp,
          persisted: true, // 👈 Indica que es permanente
          storage: result.storage
        },
        metadata: {
          request_id: req.adminRequestId,
          note: "Este cambio sobrevive a reinicios del servidor"
        }
      });

    } catch (error) {
      console.error(`❌ [${req.adminRequestId}] Error al cambiar precio permanente:`, error.message);
      
      res.status(500).json({
        success: false,
        error: "Error interno al cambiar el precio permanentemente",
        code: "PERMANENT_PRICE_UPDATE_ERROR",
        request_id: req.adminRequestId,
        ...(process.env.NODE_ENV === "development" && { debug: error.message })
      });
    }
  }
);

// -------------------------
// ✏️ Endpoint: PUT /api/admin/price (TEMPORAL - se mantiene igual)
// -------------------------
router.put("/price", 
  adminLimiter, 
  adminOnly, 
  priceValidation,
  (req, res) => {
    try {
      // Validar resultados de express-validator
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Datos de entrada inválidos",
          details: errors.array(),
          request_id: req.adminRequestId
        });
      }

      const newPrice = Number(req.body.unit_price);
      const oldPrice = getUnitPrice();
      
      console.log(`💰 [${req.adminRequestId}] Actualizando precio: $${oldPrice} → $${newPrice}`);

      // Actualizar precio (temporal)
      const updatedPrice = setRuntimeUnitPrice(newPrice);
      
      // Log del cambio
      console.log(`✅ [${req.adminRequestId}] Precio actualizado exitosamente: $${updatedPrice}`);
      
      res.json({
        success: true,
        message: "Precio actualizado correctamente",
        data: {
          previous_price: oldPrice,
          new_price: updatedPrice,
          change_percent: ((updatedPrice - oldPrice) / oldPrice * 100).toFixed(2),
          currency_id: "ARS",
          updated_at: new Date().toISOString(),
          persisted: false // 👈 Indica que es en memoria
        },
        metadata: {
          request_id: req.adminRequestId,
          warning: "Este cambio es en memoria y se perderá al reiniciar el servidor",
          recommendation: "Use POST /api/admin/price/permanent para cambios permanentes"
        }
      });

    } catch (error) {
      console.error(`❌ [${req.adminRequestId}] Error al cambiar precio:`, error.message);
      
      res.status(500).json({
        success: false,
        error: "Error interno al cambiar el precio",
        code: "PRICE_UPDATE_ERROR",
        request_id: req.adminRequestId,
        ...(process.env.NODE_ENV === "development" && { debug: error.message })
      });
    }
  }
);

// -------------------------
// 📊 Endpoint: GET /api/admin/price
// -------------------------
router.get("/price", adminLimiter, adminOnly, (_req, res) => {
  try {
    const price = getUnitPrice();
    
    res.json({
      success: true,
      data: {
        unit_price: price,
        currency_id: "ARS",
        updated_at: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development"
      },
      metadata: {
        request_id: _req.adminRequestId,
        note: "Use POST /price/permanent para cambios que sobrevivan reinicios"
      }
    });

  } catch (error) {
    console.error(`❌ [${_req.adminRequestId}] Error al obtener precio:`, error.message);
    
    res.status(500).json({
      success: false,
      error: "Error al obtener precio actual",
      code: "PRICE_FETCH_ERROR",
      request_id: _req.adminRequestId
    });
  }
});

// -------------------------
// 📈 Endpoint: GET /api/admin/stats
// -------------------------
router.get("/stats", adminLimiter, adminOnly, (_req, res) => {
  try {
    const stats = {
      pricing: {
        current_price: getUnitPrice(),
        currency: "ARS",
        last_updated: new Date().toISOString()
      },
      system: {
        node_version: process.version,
        environment: process.env.NODE_ENV || "development",
        uptime: process.uptime(),
        memory_usage: process.memoryUsage()
      },
      api: {
        rate_limit: "30/15min",
        endpoints: [
          { path: "/price", methods: ["GET", "PUT"], type: "temporal" },
          { path: "/price/permanent", methods: ["POST"], type: "permanent" },
          { path: "/stats", methods: ["GET"] }
        ]
      }
    };

    res.json({
      success: true,
      data: stats,
      metadata: {
        request_id: _req.adminRequestId,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`❌ [${_req.adminRequestId}] Error al obtener stats:`, error.message);
    
    res.status(500).json({
      success: false,
      error: "Error al obtener estadísticas",
      code: "STATS_FETCH_ERROR",
      request_id: _req.adminRequestId
    });
  }
});

// -------------------------
// 🩺 Health check específico de admin
// -------------------------
router.get("/health", adminOnly, (_req, res) => {
  const health = {
    status: "healthy",
    service: "admin",
    timestamp: new Date().toISOString(),
    authentication: {
      required: true,
      method: "x-admin-key",
      configured: !!process.env.ADMIN_KEY
    },
    endpoints: [
      { path: "/price", methods: ["GET", "PUT"], persistence: "temporal" },
      { path: "/price/permanent", methods: ["POST"], persistence: "permanent" },
      { path: "/stats", methods: ["GET"] },
      { path: "/health", methods: ["GET"] }
    ],
    limits: {
      rate_limit: "30/15min",
      max_price_change: "50%"
    }
  };

  res.json(health);
});

export default router;