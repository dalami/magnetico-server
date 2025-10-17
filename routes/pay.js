// routes/pay.js
import { Router } from "express";
import axios from "axios";
import crypto from "crypto";
import { getUnitPrice } from "../services/pricing.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { name, email, quantity } = req.body;

    // Validaciones
    if (!name?.trim() || !email?.trim() || !quantity) {
      return res.status(400).json({ error: "Faltan nombre, email o cantidad." });
    }

    // Cálculo del pedido
    const qty = Math.max(1, Math.min(Number(quantity) || 1, 20));
    const unit = getUnitPrice();
    const total = unit * qty;
    const uniqueId = crypto.randomBytes(6).toString("hex");

    const FRONTEND_URL = (process.env.FRONTEND_URL || "https://magnetico-app.vercel.app")
      .trim()
      .replace(/\/+$/, "");

    // 🧾 Crear payload para Mercado Pago
    const payload = {
      items: [
        {
          id: `pedido-${uniqueId}`,
          title: `${qty} foto${qty > 1 ? "s" : ""} imantada${qty > 1 ? "s" : ""}`,
          description: "Fotos personalizadas Magnético Fotoimanes",
          quantity: qty,
          unit_price: unit,
          currency_id: "ARS",
        },
      ],
      payer: { email },
      back_urls: {
        success: `${FRONTEND_URL}/success?ref=${uniqueId}`,
        failure: `${FRONTEND_URL}/error?ref=${uniqueId}`,
        pending: `${FRONTEND_URL}/pending?ref=${uniqueId}`,
      },
      auto_return: "approved",
      external_reference: uniqueId,
      statement_descriptor: "MAGNETICO",
      metadata: { name, email, qty, unit, total }, // ✅ CORREGIDO
    };

    // 🚀 Crear preferencia de pago
    const mpResponse = await axios.post(
      "https://api.mercadopago.com/checkout/preferences",
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const isSandbox = (process.env.MP_ACCESS_TOKEN || "").startsWith("TEST-");
    const init_point = isSandbox
      ? mpResponse.data.sandbox_init_point
      : mpResponse.data.init_point;

    // ✅ Responder al frontend
    res.status(201).json({ init_point });
  } catch (error) {
    console.error("❌ Error en /api/pay:", error.response?.data || error.message);
    res.status(500).json({ error: "Error al crear la orden de pago." });
  }
});

export default router;
