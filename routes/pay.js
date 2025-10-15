import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import payRoutes from "./routes/pay.js";


dotenv.config();

const app = express();

// 🔥 CONFIGURACIÓN CORS CORRECTA
app.use(
  cors({
    origin: ["https://magnetico-server-1.onrender.com"], // dominio frontend
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());
app.use("/api/pay", payRoutes);

app.get("/", (req, res) => {
  res.send("Servidor Magnetico activo 🚀");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
