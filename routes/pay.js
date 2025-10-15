import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

router.post("/", async (req, res) => {
  try {
    const { name, email, price } = req.body;

    const preference = new Preference(client);
    const body = {
      items: [
        {
          title: `Pedido de ${name || "Cliente"}`,
          description: "Fotoimanes personalizados",
          quantity: 1,
          unit_price: Number(price) || 2000,
          currency_id: "ARS",
        },
      ],
      payer: { email },
      back_urls: {
        success: `${process.env.FRONTEND_URL}/success`,
        failure: `${process.env.FRONTEND_URL}/error`,
      },
      auto_return: "approved",
    };

    const result = await preference.create({ body });
    res.json({ id: result.id });
  } catch (error) {
    console.error("❌ Error al crear preferencia:", error.message);
    res.status(500).json({ error: "No se pudo crear la preferencia" });
  }
});

export default router;
