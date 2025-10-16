import express from "express";
import { getUnitPrice } from "../services/pricing.js";

const router = express.Router();


/**
 * Devuelve la configuración pública de la app
 * (precio actual, moneda, versión, etc.)
 */
router.get("/", (_req, res) => {
  try {
    res.json({
      unit_price: getUnitPrice(),
      currency_id: "ARS",
      version: "1.0.0",
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error en /api/config:", error);
    res.status(500).json({ error: "Error al obtener configuración" });
  }
});

export default router;
