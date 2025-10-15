import express from "express";
import mercadopago from "mercadopago";

const router = express.Router();

// ✅ Configuración del cliente Mercado Pago (SDK v2)
const client = new mercadopago.MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

router.post("/", async (req, res) => {
  try {
    const { name, email, price } = req.body;

    const preference = await client.preferences.create({
      body: {
        items: [
          {
            title: `Pedido de ${name || "Cliente"}`,
            quantity: 1,
            currency_id: "ARS",
            unit_price: Number(price) || 2000,
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
      },
    });

    res.json({ id: preference.id });
  } catch (error) {
    console.error("❌ Error al crear preferencia:", error);
    res.status(500).json({ error: "No se pudo crear la preferencia." });
  }
});

export default router;
