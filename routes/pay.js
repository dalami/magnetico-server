// routes/pay.js
import express from "express";
import axios from "axios";

const router = express.Router();

const baseUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
const token = process.env.MP_ACCESS_TOKEN;

const tokenInfo = (t) => (t ? `${t.slice(0,6)}...${t.slice(-4)} (len:${t.length})` : "MISSING");

router.post("/", async (req, res) => {
  try {
    const { name, email, price, items } = req.body;

    if (!email) return res.status(400).json({ error: "Email es obligatorio." });
    if (!token) return res.status(500).json({ error: "Falta MP_ACCESS_TOKEN en el servidor." });

    const normalizedItems =
      Array.isArray(items) && items.length
        ? items.map(it => ({
            id: it.id || "fotomagnetico",
            title: it.title || `Pedido de ${name || "Cliente"}`,
            quantity: Number(it.quantity || 1),
            currency_id: it.currency_id || "ARS",
            unit_price: Number(it.unit_price ?? price ?? 2000),
          }))
        : [{
            id: "fotomagnetico",
            title: `Pedido de ${name || "Cliente"}`,
            quantity: 1,
            currency_id: "ARS",
            unit_price: Number(price ?? 2000),
          }];

    const payload = {
      items: normalizedItems,
      payer: { email },
      back_urls: {
        success: `${baseUrl}/success`,
        failure: `${baseUrl}/error`,
        pending: `${baseUrl}/pending`,
      },
      auto_return: "approved",
      statement_descriptor: "MAGNETICO",
    };

    console.log("🟢 Crear preferencia (REST) →", {
      email,
      items: normalizedItems.map(i => ({ t: i.title, q: i.quantity, p: i.unit_price })),
      FRONTEND_URL: baseUrl,
      MP_TOKEN: tokenInfo(token),
    });

    const { data } = await axios.post(
      "https://api.mercadopago.com/checkout/preferences",
      payload,
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, timeout: 20000 }
    );

    return res.status(201).json({ id: data.id, init_point: data.init_point, sandbox_init_point: data.sandbox_init_point });

  } catch (error) {
    console.error("❌ MP REST error:", {
      status: error?.response?.status,
      data: error?.response?.data,
      msg: error?.message,
    });

    const detail =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      "No se pudo crear la preferencia.";
    return res.status(500).json({ error: detail });
  }
});

/** Diagnóstico: verificar token */
router.get("/debug", async (_req, res) => {
  try {
    if (!token) return res.status(500).json({ ok:false, error: "Falta MP_ACCESS_TOKEN." });
    const { data } = await axios.get("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    res.json({ ok:true, nickname: data.nickname, site_id: data.site_id, token: tokenInfo(token) });
  } catch (e) {
    res.status(500).json({ ok:false, error: e?.response?.data || e.message });
  }
});

/** Smoke test: crea una preferencia fija */
router.post("/test", async (_req, res) => {
  try {
    const { data } = await axios.post(
      "https://api.mercadopago.com/checkout/preferences",
      {
        items: [{ title: "Prueba Magnetico", quantity: 1, currency_id: "ARS", unit_price: 2000 }],
        back_urls: { success: `${baseUrl}/success`, failure: `${baseUrl}/error`, pending: `${baseUrl}/pending` },
        auto_return: "approved",
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    res.json({ id: data.id, init_point: data.init_point });
  } catch (e) {
    res.status(500).json({ error: e?.response?.data || e.message });
  }
});

export default router;
