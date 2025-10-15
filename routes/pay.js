import express from "express";
import mercadopago from "mercadopago";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// ✅ Configurar SDK de Mercado Pago
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// ✅ Crear preferencia de pago
router.post("/", async (req, res) => {
  try {
    const { name, email, price } = req.body;
    console.log("🟢 Recibido en /api/pay:", { name, email, price });

    if (!price || !email) {
      console.error("❌ Falta email o precio");
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const preference = {
      items: [
        {
          title: `Pedido de ${name || "Cliente"}`,
          unit_price: Number(price),
          quantity: 1,
          currency_id: "ARS",
        },
      ],
      payer: {
        email,
      },
      back_urls: {
        success: `${process.env.FRONTEND_URL}/success`,
        failure: `${process.env.FRONTEND_URL}/error`,
      },
      auto_return: "approved",
    };

    console.log("🟡 Creando preferencia con:", preference);

    const response = await mercadopago.preferences.create(preference);
    console.log("✅ Preferencia creada:", response.body.id);

    return res.json({ id: response.body.id });
  } catch (error) {
    console.error("❌ Error al crear preferencia:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
