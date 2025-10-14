import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// 🧩 Inicializar cliente Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.ACCESS_TOKEN,
});

// ✅ Ruta GET de prueba (para comprobar que la API responde)
router.get("/", (req, res) => {
  res.json({ message: "🟢 API de pagos funcionando correctamente" });
});

// 💳 Ruta POST para crear la preferencia de pago
router.post("/", async (req, res) => {
  try {
    const { name, email } = req.body;

    // 🔹 Precio configurable (ARS)
    const precio = 2000; // <-- cambiá este valor cuando quieras

    const preference = new Preference(client);
    const body = {
      items: [
        {
          title: `Pedido de ${name || "Cliente"}`,
          description: "Fotoimanes personalizados",
          quantity: 1,
          unit_price: precio,
          currency_id: "ARS",
        },
      ],
      payer: { email },
      back_urls: {
        success: "https://magnetico-app.vercel.app/success",
        failure: "https://magnetico-app.vercel.app/error",
      },
      auto_return: "approved",
    };

    const result = await preference.create({ body });
    console.log("✅ Preferencia creada:", result.id);
    res.json({ id: result.id });
  } catch (error) {
    console.error("❌ Error al crear preferencia:", error.message);
    res.status(500).json({ error: "No se pudo crear la preferencia" });
  }
});

export default router;
