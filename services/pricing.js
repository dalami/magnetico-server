// -------------------------
// services/pricing.js - PRODUCTION READY (CON PERSISTENCIA)
// -------------------------

import fs from 'fs';
import path from 'path';

// 💾 Variable temporal en memoria (no persiste tras reinicio)
let runtimePrice = null;
let priceHistory = [];
const MAX_HISTORY_SIZE = 50;

// -------------------------
// 🔧 Configuración y Constantes
// -------------------------
const PRICE_CONFIG = {
  DEFAULT_PRICE: 4000,
  MIN_PRICE: 100,
  MAX_PRICE: 100000,
  CURRENCY: 'ARS',
  ENV_VAR: 'PRODUCT_UNIT_PRICE'
};

// 📁 Archivo de persistencia
const PRICE_FILE = path.join(process.cwd(), 'data', 'price-config.json');

// -------------------------
// 🗄️ Funciones de Persistencia
// -------------------------
function ensureDataDir() {
  const dataDir = path.dirname(PRICE_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function getStoredPrice() {
  try {
    ensureDataDir();
    if (fs.existsSync(PRICE_FILE)) {
      const data = JSON.parse(fs.readFileSync(PRICE_FILE, 'utf8'));
      return data.price;
    }
  } catch (error) {
    console.warn('No se pudo leer archivo de precio, usando fallback:', error.message);
  }
  return null;
}

function storePrice(price) {
  try {
    ensureDataDir();
    const priceData = {
      price,
      currency: PRICE_CONFIG.CURRENCY,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'admin',
      environment: process.env.NODE_ENV || 'development'
    };
    fs.writeFileSync(PRICE_FILE, JSON.stringify(priceData, null, 2));
    return true;
  } catch (error) {
    console.error('Error guardando precio:', error);
    return false;
  }
}

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
// 🔹 Servicio Principal de Precios - ACTUALIZADO
// -------------------------

/**
 * 🔹 Obtiene el precio unitario actual.
 * Prioriza en orden:
 * 1️⃣ Precio temporal (runtime)
 * 2️⃣ Precio persistente (JSON file)
 * 3️⃣ PRODUCT_UNIT_PRICE definido en .env
 * 4️⃣ Valor por defecto $4000
 */
export function getUnitPrice() {
  try {
    const storedPrice = getStoredPrice();
    const envPrice = process.env[PRICE_CONFIG.ENV_VAR] 
      ? Number(process.env[PRICE_CONFIG.ENV_VAR])
      : null;

    const rawPrice = runtimePrice ?? storedPrice ?? envPrice ?? PRICE_CONFIG.DEFAULT_PRICE;
    const price = validatePrice(rawPrice, 'getUnitPrice');
    
    // Log solo si hay cambios significativos o en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log(`💰 Precio obtenido: $${price}`, {
        source: runtimePrice ? 'runtime' : storedPrice ? 'persisted' : envPrice ? 'env' : 'default',
        runtimePrice,
        storedPrice,
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
 * 🔹 Modifica el precio PERMANENTEMENTE usando archivo JSON
 * @param {number} value - Nuevo precio unitario
 * @returns {Object} Resultado de la operación
 * @throws {PricingError} Si el precio no es válido
 */
export function setPermanentPrice(value) {
  try {
    const oldPrice = getUnitPrice();
    const newPrice = validatePrice(value, 'setPermanentPrice');
    
    // Guardar permanentemente en archivo JSON
    const storageSuccess = storePrice(newPrice);
    
    if (!storageSuccess) {
      throw new PricingError(
        'No se pudo guardar el precio permanentemente',
        'PRICE_STORAGE_ERROR',
        { attemptedValue: value }
      );
    }
    
    // También actualizar en runtime para uso inmediato
    runtimePrice = newPrice;
    
    // Registrar cambio en historial
    const historyEntry = addToPriceHistory(oldPrice, newPrice, 'permanent_admin');
    
    console.log(`💰 Precio actualizado PERMANENTEMENTE: $${oldPrice} → $${newPrice} (${historyEntry.changePercent}%)`, {
      requestId: `permanent-price-update-${Date.now()}`,
      change: historyEntry.changePercent,
      source: 'permanent_admin',
      storage: 'json_file',
      timestamp: historyEntry.timestamp
    });
    
    return {
      success: true,
      oldPrice,
      newPrice,
      changePercent: historyEntry.changePercent,
      storage: 'json_file',
      persisted: true,
      timestamp: historyEntry.timestamp
    };
    
  } catch (error) {
    if (error instanceof PricingError) {
      console.error(`❌ Error al actualizar precio permanentemente:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        attemptedValue: value
      });
      throw error;
    }
    
    const genericError = new PricingError(
      `Error interno al actualizar precio permanentemente: ${error.message}`,
      'PERMANENT_PRICE_UPDATE_ERROR',
      { attemptedValue: value }
    );
    
    console.error(`❌ Error inesperado en setPermanentPrice:`, genericError);
    throw genericError;
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
    
    // Actualizar precio (solo en memoria)
    runtimePrice = newPrice;
    
    console.log(`💰 Precio actualizado (TEMPORAL): $${oldPrice} → $${newPrice} (${historyEntry.changePercent}%)`, {
      requestId: `runtime-price-update-${Date.now()}`,
      change: historyEntry.changePercent,
      source: 'admin',
      persisted: false,
      timestamp: historyEntry.timestamp
    });
    
    return newPrice;
    
  } catch (error) {
    if (error instanceof PricingError) {
      console.error(`❌ Error al actualizar precio temporal:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        attemptedValue: value
      });
      throw error;
    }
    
    const genericError = new PricingError(
      `Error interno al actualizar precio temporal: ${error.message}`,
      'RUNTIME_PRICE_UPDATE_ERROR',
      { attemptedValue: value }
    );
    
    console.error(`❌ Error inesperado en setRuntimeUnitPrice:`, genericError);
    throw genericError;
  }
}

/**
 * 🔹 Restablece el precio al valor persistente o de entorno.
 * @returns {number} Precio restablecido
 */
export function resetRuntimePrice() {
  const oldPrice = getUnitPrice();
  runtimePrice = null;
  const newPrice = getUnitPrice();
  
  // Registrar reset en historial
  addToPriceHistory(oldPrice, newPrice, 'reset');
  
  console.log(`🔄 Precio restablecido: $${newPrice}`, {
    previousRuntime: oldPrice,
    newSource: getStoredPrice() ? 'persisted' : process.env[PRICE_CONFIG.ENV_VAR] ? 'env' : 'default'
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
  const storedPrice = getStoredPrice();
  
  return {
    current: {
      price: currentPrice,
      currency: PRICE_CONFIG.CURRENCY,
      source: runtimePrice ? 'runtime' : storedPrice ? 'persisted' : envPrice ? 'env' : 'default'
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
    persistence: {
      active: storedPrice !== null,
      value: storedPrice,
      file: PRICE_FILE
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
  const storedPrice = getStoredPrice();
  
  return {
    runtime: runtimePrice,
    persisted: storedPrice,
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
    },
    storage: {
      file: PRICE_FILE,
      exists: fs.existsSync(PRICE_FILE)
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
    const storedPrice = getStoredPrice();
    
    console.log(`💰 Servicio de precios inicializado: $${initialPrice} ${PRICE_CONFIG.CURRENCY}`, {
      source: runtimePrice ? 'runtime' : storedPrice ? 'persisted' : process.env[PRICE_CONFIG.ENV_VAR] ? 'env' : 'default',
      persisted: !!storedPrice,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
    
    // Validar que el precio de entorno sea válido (si existe)
    if (process.env[PRICE_CONFIG.ENV_VAR]) {
      try {
        validatePrice(process.env[PRICE_CONFIG.ENV_VAR], 'env_validation');
      } catch (error) {
        console.warn(`⚠️ Precio en .env inválido:`, {
          envValue: process.env[PRICE_CONFIG.ENV_VAR],
          error: error.message
        });
      }
    }
    
  } catch (error) {
    console.error(`❌ Error crítico al inicializar servicio de precios:`, error);
  }
})();

export default {
  getUnitPrice,
  setRuntimeUnitPrice,
  setPermanentPrice, // 👈 NUEVA FUNCIÓN EXPORTADA
  resetRuntimePrice,
  getPricingStats,
  debugPricing,
  validateExternalPrice
};