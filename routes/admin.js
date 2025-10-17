import express from "express";
import { getUnitPrice, setRuntimeUnitPrice } from "../services/pricing.js";

const router = express.Router();

/**
 * Middleware de protección para rutas administrativas.
 * Requiere el header:  x-admin-key: process.env.ADMIN_KEY
 */
function adminOnly(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (!process.env.ADMIN_KEY) {
    console.error("⚠️ Falta ADMIN_KEY en el entorno");
    return res.status(500).json({ error: "Configuración incompleta en el servidor" });
  }
  if (key !== process.env.ADMIN_KEY) {
    console.warn("🚫 Intento de acceso no autorizado desde:", req.ip);
    return res.status(403).json({ error: "Acceso denegado" });
  }
  next();
}

/**
 * 🟢 Obtener precio actual
 * Endpoint: GET /api/admin/price
 */
router.get("/price", adminOnly, (_req, res) => {
  try {
    res.json({
      unit_price: getUnitPrice(),
      currency_id: "ARS",
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error al obtener precio:", error.message);
    res.status(500).json({ error: "Error al obtener precio actual" });
  }
});

/**
 * 🟠 Actualizar precio en runtime (no persiste tras reinicio)
 * Endpoint: PUT /api/admin/price
 * Body: { "unit_price": 2500 }
 */
router.put("/price", adminOnly, (req, res) => {
  try {
    const v = Number(req.body?.unit_price);
    if (!Number.isFinite(v) || v <= 0) {
      return res.status(400).json({ error: "El precio debe ser un número positivo" });
    }

    const newPrice = setRuntimeUnitPrice(v);
    console.log(`💰 Precio actualizado en memoria: $${newPrice}`);

    res.json({
      message: "Precio actualizado correctamente",
      unit_price: newPrice,
      persisted: false,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error al cambiar precio:", error.message);
    res.status(500).json({ error: "Error al cambiar el precio" });
  }
});

export default router;
