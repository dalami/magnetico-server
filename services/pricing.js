// ✅ Variable interna en memoria (permite cambiar el precio sin reiniciar el servidor)
let runtimePrice = null;

/**
 * Obtiene el precio unitario actual.
 * Prioriza:
 * 1️⃣ Precio temporal en memoria (setRuntimeUnitPrice)
 * 2️⃣ Variable de entorno PRODUCT_UNIT_PRICE
 * 3️⃣ Valor por defecto 2000
 */
export function getUnitPrice() {
  const envPrice = process.env.PRODUCT_UNIT_PRICE
    ? Number(process.env.PRODUCT_UNIT_PRICE)
    : null;

  // Devuelve el precio convertido a número
  return Number(runtimePrice ?? envPrice ?? 2000);
}

/**
 * Permite modificar el precio temporalmente en runtime (ej. desde un panel admin)
 * Ejemplo: setRuntimeUnitPrice(2500);
 */
export function setRuntimeUnitPrice(value) {
  const num = Number(value);
  if (isNaN(num) || num <= 0) {
    throw new Error("El precio debe ser un número positivo");
  }
  runtimePrice = num;
  console.log(`💰 Precio temporal actualizado a: $${runtimePrice}`);
  return runtimePrice;
}

/**
 * Opcional: restablece el precio al valor original del entorno
 */
export function resetRuntimePrice() {
  runtimePrice = null;
  console.log("🔄 Precio temporal restablecido al valor del entorno");
  return getUnitPrice();
}

