// -------------------------
// routes/config.js - PRODUCTION READY (CORREGIDO)
// -------------------------
import express from "express";
import rateLimit from "express-rate-limit";
import { getUnitPrice } from "../services/pricing.js";

const router = express.Router();

// -------------------------
// 🔐 Rate Limiting para config
// -------------------------
const configLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // 60 requests por minuto (frecuente en frontend)
  message: {
    error: "Demasiadas solicitudes de configuración.",
    retry_after: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// -------------------------
// 🧪 Health check del servicio de precios
// -------------------------
const validatePricingService = () => {
  try {
    const price = getUnitPrice();
    return {
      healthy: true,
      price: price,
      hasValidPrice: price > 0 && Number.isFinite(price)
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      price: null
    };
  }
};

// -------------------------
// 📦 Cache in-memory para configuración
// -------------------------
let configCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

const getCachedConfig = () => {
  const now = Date.now();
  
  if (configCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return configCache;
  }

  // Validar que el servicio de precios funcione
  const pricingHealth = validatePricingService();
  
  if (!pricingHealth.healthy) {
    throw new Error(`Servicio de precios no disponible: ${pricingHealth.error}`);
  }

  if (!pricingHealth.hasValidPrice) {
    throw new Error("Precio unitario no válido o no configurado");
  }

  const newConfig = {
    unit_price: pricingHealth.price,
    currency_id: "ARS",
    version: process.env.npm_package_version || "1.0.0",
    updated_at: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    features: {
      max_photos: 15,
      max_file_size: 8 * 1024 * 1024, // 8MB
      supported_formats: ["JPEG", "PNG", "WebP"]
    },
    maintenance: process.env.MAINTENANCE_MODE === "true" || false
  };

  configCache = newConfig;
  cacheTimestamp = now;

  return newConfig;
};

// -------------------------
// 💰 Endpoint ÚNICO para precio - FORMATO CORRECTO
// -------------------------
router.get("/price", configLimiter, (_req, res) => {
  try {
    const config = getCachedConfig();
    
    res.set('Cache-Control', 'public, max-age=60');
    
    // ✅ FORMATO CORRECTO que el frontend espera
    res.json({
      success: true,
      unit_price: config.unit_price,      // ← unit_price (no price)
      currency_id: config.currency_id,    // ← currency_id (no currency)
      updated_at: config.updated_at
    });

  } catch (error) {
    console.error("❌ Error en /api/config/price:", error.message);
    
    res.status(500).json({
      success: false,
      error: "Error al obtener precio",
      unit_price: null,
      currency_id: "ARS"
    });
  }
});

// -------------------------
// 🔧 Endpoint principal de configuración (OPCIONAL)
// -------------------------
router.get("/", configLimiter, (_req, res) => {
  try {
    const config = getCachedConfig();
    
    res.set('Cache-Control', 'public, max-age=60');
    
    res.json({
      success: true,
      data: config,
      cache: {
        cached: configCache !== null,
        generated_at: cacheTimestamp ? new Date(cacheTimestamp).toISOString() : null
      }
    });

  } catch (error) {
    console.error("❌ Error en /api/config:", error.message);

    const statusCode = error.message.includes('no disponible') ? 503 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: "Error al obtener configuración",
      message: process.env.NODE_ENV === "development" ? error.message : "Servicio temporalmente no disponible",
      ...(process.env.NODE_ENV === "development" && { debug: error.stack })
    });
  }
});

// -------------------------
// 🩺 Health check extendido del módulo config
// -------------------------
router.get("/health", (_req, res) => {
  const health = {
    status: "healthy",
    service: "config",
    timestamp: new Date().toISOString(),
    dependencies: {
      pricing_service: validatePricingService(),
      environment: process.env.NODE_ENV || "development"
    },
    cache: {
      enabled: configCache !== null,
      last_updated: cacheTimestamp ? new Date(cacheTimestamp).toISOString() : "never",
      duration: `${CACHE_DURATION / 1000}s`
    },
    limits: {
      rate_limit: "60/1min"
    }
  };

  // Determinar salud general
  if (!health.dependencies.pricing_service.healthy || !health.dependencies.pricing_service.hasValidPrice) {
    health.status = "unhealthy";
  }

  res.status(health.status === "healthy" ? 200 : 503).json(health);
});

// -------------------------
// 🔄 Endpoint para forzar recarga de cache (solo desarrollo)
// -------------------------
if (process.env.NODE_ENV !== "production") {
  router.post("/cache/clear", (_req, res) => {
    const previousCache = configCache;
    configCache = null;
    cacheTimestamp = null;
    
    console.log("🧹 Cache de configuración limpiado manualmente");
    
    res.json({
      success: true,
      message: "Cache limpiado",
      previous_cache: previousCache ? {
        unit_price: previousCache.unit_price,
        updated_at: previousCache.updated_at
      } : null
    });
  });
}

export default router;