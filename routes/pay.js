// routes/pay.js
import express from "express";
import axios from "axios";
import crypto from "crypto";
import { getUnitPrice } from "../services/pricing.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { name, email, quantity = 1 } = req.body;
    if (!email) return res.status(400).json({ error: "Email requerido" });

    const qty = Math.max(1, Math.min(Number(quantity) || 1, 20));
    const unit = getUnitPrice();

    const uniqueId = crypto.randomBytes(6).toString("hex");
    const title = `${qty} foto${qty > 1 ? "s" : ""} imantada${qty > 1 ? "s" : ""}`;

    console.log("======================================");
    console.log("🧮 Pedido recibido:");
    console.log("👤 Nombre:", name);
    console.log("📧 Email:", email);
    console.log("🖼️ Cantidad:", qty);
    console.log("💵 Precio unitario:", unit);
    console.log("======================================");

    const payload = {
      items: [
        {
          id: `pedido-${uniqueId}`,
          title: `Pedido de ${title}`,
          description: "Fotos personalizadas Magnetico",
          quantity: qty, // 👈 se envía cantidad real
          unit_price: unit, // 👈 se envía precio unitario
          currency_id: "ARS",
        },
      ],
      payer: { email },
      back_urls: {
        success: `${process.env.FRONTEND_URL}/success`,
        failure: `${process.env.FRONTEND_URL}/error`,
        pending: `${process.env.FRONTEND_URL}/pending`,
      },
      auto_return: "approved",
      external_reference: uniqueId,
      statement_descriptor: "MAGNETICO",
      metadata: { qty, unit, total: unit * qty },
    };

    console.log("🟢 Payload enviado a MP:", JSON.stringify(payload, null, 2));

    const { data } = await axios.post(
      "https://api.mercadopago.com/checkout/preferences",
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Preferencia creada:", data.id);

    const isSandbox = (process.env.MP_ACCESS_TOKEN || "").startsWith("TEST-");
    const checkout_url = isSandbox ? data.sandbox_init_point : data.init_point;

    res.status(201).json({
      id: data.id,
      qty,
      unit,
      total: unit * qty,
      checkout_url,
    });
  } catch (error) {
    console.error("❌ Error al crear preferencia:", error?.response?.data || error.message);
    res.status(500).json({ error: error?.response?.data || error.message });
  }
});

export default router;
