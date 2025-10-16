import express from "express";
import { getUnitPrice, setRuntimeUnitPrice } from "../services/pricing.js";

const router = express.Router();

function adminOnly(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    console.warn("🚫 Intento de acceso sin clave válida");
    return res.status(403).json({ error: "forbidden" });
  }
  next();
}

// 🟢 Obtener precio actual
router.get("/price", adminOnly, (_req, res) => {
  res.json({ unit_price: getUnitPrice() });
});

// 🟠 Cambiar precio en runtime (no persiste tras reinicio)
router.put("/price", adminOnly, (req, res) => {
  const v = Number(req.body?.unit_price);
  if (!Number.isFinite(v) || v <= 0) {
    return res.status(400).json({ error: "unit_price inválido" });
  }
  const newPrice = setRuntimeUnitPrice(v);
  console.log(`💰 Precio cambiado a $${newPrice} (runtime)`);
  res.json({ unit_price: newPrice, persisted: false });
});

export default router;
