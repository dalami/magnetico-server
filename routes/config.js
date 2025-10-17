import express from "express";
import { getUnitPrice } from "../services/pricing.js";

const router = express.Router();

/**
 * 📦 Devuelve configuración pública de la app
 * (precio actual, moneda, versión, etc.)
 */
router.get("/", (_req, res) => {
  try {
    const config = {
      unit_price: getUnitPrice(),
      currency_id: "ARS",
      version: "1.0.0",
      updated_at: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    };

    res.json(config);
  } catch (error) {
    console.error("❌ Error en /api/config:", error.message);
    res.status(500).json({ error: "Error al obtener configuración." });
  }
});

export default router;
