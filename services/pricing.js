// -------------------------
// services/pricing.js
// -------------------------

// 💾 Variable temporal en memoria (no persiste tras reinicio)
let runtimePrice = null;

/**
 * 🔹 Obtiene el precio unitario actual.
 * Prioriza en orden:
 * 1️⃣ Precio temporal (runtime)
 * 2️⃣ PRODUCT_UNIT_PRICE definido en .env
 * 3️⃣ Valor por defecto $2000
 */
export function getUnitPrice() {
  const envPrice = process.env.PRODUCT_UNIT_PRICE
    ? Number(process.env.PRODUCT_UNIT_PRICE)
    : null;

  const price = Number(runtimePrice ?? envPrice ?? 2000);

  if (!Number.isFinite(price) || price <= 0) {
    console.warn("⚠️ Precio inválido detectado, usando valor por defecto (2000)");
    return 2000;
  }

  return price;
}

/**
 * 🔹 Modifica el precio temporalmente sin reiniciar el servidor.
 * Ejemplo: setRuntimeUnitPrice(2500);
 */
export function setRuntimeUnitPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error("El precio debe ser un número positivo");
  }

  runtimePrice = num;
  console.log(`💰 Precio temporal actualizado: $${runtimePrice}`);
  return runtimePrice;
}

/**
 * 🔹 Restablece el precio al valor original de entorno.
 */
export function resetRuntimePrice() {
  runtimePrice = null;
  console.log("🔄 Precio temporal restablecido al valor de entorno (.env)");
  return getUnitPrice();
}

/**
 * 🔹 Muestra el estado interno del servicio (para debug o panel admin)
 */
export function debugPricing() {
  return {
    runtime: runtimePrice,
    env: process.env.PRODUCT_UNIT_PRICE ? Number(process.env.PRODUCT_UNIT_PRICE) : null,
    current: getUnitPrice(),
    timestamp: new Date().toISOString(),
  };
}
