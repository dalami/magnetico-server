// -------------------------
// services/pricing.js - PRODUCTION READY
// -------------------------

// 💾 Variable temporal en memoria (no persiste tras reinicio)
let runtimePrice = null;
let priceHistory = [];
const MAX_HISTORY_SIZE = 50;

// -------------------------
// 🔧 Configuración y Constantes
// -------------------------
const PRICE_CONFIG = {
  DEFAULT_PRICE: 2000,
  MIN_PRICE: 100,
  MAX_PRICE: 100000,
  CURRENCY: 'ARS',
  ENV_VAR: 'PRODUCT_UNIT_PRICE'
};

// -------------------------
// 🎯 Utilidades de Validación
// -------------------------
class PricingError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'PricingError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

const validatePrice = (price, context = 'validation') => {
  const num = Number(price);
  
  if (typeof price === 'undefined' || price === null) {
    throw new PricingError('Precio no puede ser nulo o indefinido', 'PRICE_NULL', { context });
  }
  
  if (isNaN(num)) {
    throw new PricingError('Precio debe ser un número válido', 'PRICE_NAN', { 
      context, 
      received: typeof price 
    });
  }
  
  if (!Number.isFinite(num)) {
    throw new PricingError('Precio debe ser un número finito', 'PRICE_INFINITE', { 
      context, 
      value: price 
    });
  }
  
  if (num < PRICE_CONFIG.MIN_PRICE) {
    throw new PricingError(
      `Precio no puede ser menor a ${PRICE_CONFIG.MIN_PRICE}`, 
      'PRICE_TOO_LOW', 
      { context, value: num, min: PRICE_CONFIG.MIN_PRICE }
    );
  }
  
  if (num > PRICE_CONFIG.MAX_PRICE) {
    throw new PricingError(
      `Precio no puede ser mayor a ${PRICE_CONFIG.MAX_PRICE}`, 
      'PRICE_TOO_HIGH', 
      { context, value: num, max: PRICE_CONFIG.MAX_PRICE }
    );
  }
  
  return Math.round(num * 100) / 100; // Redondear a 2 decimales
};

// -------------------------
// 📊 Gestión de Historial de Precios
// -------------------------
const addToPriceHistory = (oldPrice, newPrice, source) => {
  const historyEntry = {
    oldPrice,
    newPrice,
    source,
    timestamp: new Date().toISOString(),
    changePercent: oldPrice ? ((newPrice - oldPrice) / oldPrice * 100).toFixed(2) : null
  };
  
  priceHistory.unshift(historyEntry);
  
  // Mantener el historial dentro del límite
  if (priceHistory.length > MAX_HISTORY_SIZE) {
    priceHistory = priceHistory.slice(0, MAX_HISTORY_SIZE);
  }
  
  return historyEntry;
};

// -------------------------
// 🔹 Servicio Principal de Precios
// -------------------------

/**
 * 🔹 Obtiene el precio unitario actual.
 * Prioriza en orden:
 * 1️⃣ Precio temporal (runtime)
 * 2️⃣ PRODUCT_UNIT_PRICE definido en .env
 * 3️⃣ Valor por defecto $2000
 */
export function getUnitPrice() {
  try {
    const envPrice = process.env[PRICE_CONFIG.ENV_VAR] 
      ? Number(process.env[PRICE_CONFIG.ENV_VAR])
      : null;

    const rawPrice = runtimePrice ?? envPrice ?? PRICE_CONFIG.DEFAULT_PRICE;
    const price = validatePrice(rawPrice, 'getUnitPrice');
    
    // Log solo si hay cambios significativos o en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log(`💰 Precio obtenido: $${price}`, {
        source: runtimePrice ? 'runtime' : envPrice ? 'env' : 'default',
        runtimePrice,
        envPrice
      });
    }
    
    return price;
    
  } catch (error) {
    if (error instanceof PricingError) {
      console.error(`❌ Error de validación en getUnitPrice:`, {
        code: error.code,
        message: error.message,
        details: error.details
      });
    } else {
      console.error(`❌ Error inesperado en getUnitPrice:`, error.message);
    }
    
    // Fallback seguro
    console.warn(`⚠️ Usando precio por defecto: $${PRICE_CONFIG.DEFAULT_PRICE}`);
    return PRICE_CONFIG.DEFAULT_PRICE;
  }
}

/**
 * 🔹 Modifica el precio temporalmente sin reiniciar el servidor.
 * @param {number} value - Nuevo precio unitario
 * @returns {number} Precio actualizado
 * @throws {PricingError} Si el precio no es válido
 */
export function setRuntimeUnitPrice(value) {
  try {
    const oldPrice = getUnitPrice();
    const newPrice = validatePrice(value, 'setRuntimeUnitPrice');
    
    // Registrar cambio en historial
    const historyEntry = addToPriceHistory(oldPrice, newPrice, 'admin');
    
    // Actualizar precio
    runtimePrice = newPrice;
    
    console.log(`💰 Precio actualizado: $${oldPrice} → $${newPrice} (${historyEntry.changePercent}%)`, {
      requestId: `price-update-${Date.now()}`,
      change: historyEntry.changePercent,
      source: 'admin',
      timestamp: historyEntry.timestamp
    });
    
    return newPrice;
    
  } catch (error) {
    if (error instanceof PricingError) {
      console.error(`❌ Error al actualizar precio:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        attemptedValue: value
      });
      throw error; // Re-lanzar error específico
    }
    
    // Error genérico
    const genericError = new PricingError(
      `Error interno al actualizar precio: ${error.message}`,
      'PRICE_UPDATE_ERROR',
      { attemptedValue: value }
    );
    
    console.error(`❌ Error inesperado en setRuntimeUnitPrice:`, genericError);
    throw genericError;
  }
}

/**
 * 🔹 Restablece el precio al valor original de entorno.
 * @returns {number} Precio restablecido
 */
export function resetRuntimePrice() {
  const oldPrice = getUnitPrice();
  runtimePrice = null;
  const newPrice = getUnitPrice();
  
  // Registrar reset en historial
  addToPriceHistory(oldPrice, newPrice, 'reset');
  
  console.log(`🔄 Precio restablecido a valor de entorno: $${newPrice}`, {
    previousRuntime: oldPrice,
    newSource: process.env[PRICE_CONFIG.ENV_VAR] ? 'env' : 'default'
  });
  
  return newPrice;
}

/**
 * 🔹 Obtiene estadísticas del servicio de precios
 * @returns {Object} Estadísticas y métricas
 */
export function getPricingStats() {
  const currentPrice = getUnitPrice();
  const envPrice = process.env[PRICE_CONFIG.ENV_VAR] 
    ? Number(process.env[PRICE_CONFIG.ENV_VAR])
    : null;
  
  return {
    current: {
      price: currentPrice,
      currency: PRICE_CONFIG.CURRENCY,
      source: runtimePrice ? 'runtime' : envPrice ? 'env' : 'default'
    },
    configuration: {
      defaultPrice: PRICE_CONFIG.DEFAULT_PRICE,
      minPrice: PRICE_CONFIG.MIN_PRICE,
      maxPrice: PRICE_CONFIG.MAX_PRICE,
      envVar: PRICE_CONFIG.ENV_VAR,
      envValue: envPrice
    },
    runtime: {
      active: runtimePrice !== null,
      value: runtimePrice
    },
    history: {
      totalChanges: priceHistory.length,
      recentChanges: priceHistory.slice(0, 5), // Últimos 5 cambios
      lastChange: priceHistory[0] || null
    },
    system: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    }
  };
}

/**
 * 🔹 Muestra el estado interno del servicio (para debug o panel admin)
 * @returns {Object} Estado completo del servicio
 */
export function debugPricing() {
  return {
    runtime: runtimePrice,
    env: process.env[PRICE_CONFIG.ENV_VAR] 
      ? Number(process.env[PRICE_CONFIG.ENV_VAR])
      : null,
    current: getUnitPrice(),
    currency: PRICE_CONFIG.CURRENCY,
    timestamp: new Date().toISOString(),
    historySize: priceHistory.length,
    config: {
      default: PRICE_CONFIG.DEFAULT_PRICE,
      min: PRICE_CONFIG.MIN_PRICE,
      max: PRICE_CONFIG.MAX_PRICE
    }
  };
}

/**
 * 🔹 Valida y sanitiza un precio (para uso externo)
 * @param {*} price - Precio a validar
 * @returns {Object} Resultado de la validación
 */
export function validateExternalPrice(price) {
  try {
    const validatedPrice = validatePrice(price, 'external');
    
    return {
      valid: true,
      price: validatedPrice,
      currency: PRICE_CONFIG.CURRENCY,
      message: 'Precio válido'
    };
    
  } catch (error) {
    return {
      valid: false,
      price: null,
      currency: PRICE_CONFIG.CURRENCY,
      error: error.message,
      code: error.code,
      details: error.details
    };
  }
}

// -------------------------
// 🧪 Inicialización y Validación al Cargar
// -------------------------
(function initializePricingService() {
  try {
    const initialPrice = getUnitPrice();
    
    console.log(`💰 Servicio de precios inicializado: $${initialPrice} ${PRICE_CONFIG.CURRENCY}`, {
      source: runtimePrice ? 'runtime' : process.env[PRICE_CONFIG.ENV_VAR] ? 'env' : 'default',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
    
    // Validar que el precio de entorno sea válido (si existe)
    if (process.env[PRICE_CONFIG.ENV_VAR]) {
      try {
        validatePrice(process.env[PRICE_CONFIG.ENV_VAR], 'env_validation');
      } catch (error) {
        console.warn(`⚠️ Precio en .env inválido, usando valor por defecto:`, {
          envValue: process.env[PRICE_CONFIG.ENV_VAR],
          error: error.message,
          defaultValue: PRICE_CONFIG.DEFAULT_PRICE
        });
      }
    }
    
  } catch (error) {
    console.error(`❌ Error crítico al inicializar servicio de precios:`, error);
    // El servicio continuará con el precio por defecto
  }
})();

export default {
  getUnitPrice,
  setRuntimeUnitPrice,
  resetRuntimePrice,
  getPricingStats,
  debugPricing,
  validateExternalPrice
};