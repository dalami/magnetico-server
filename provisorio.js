// -------------------------
// server.js - VERSIÓN MÍNIMA PARA TEST
// -------------------------
import express from "express";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 3001;

// 🎯 SOLO WEBHOOK - NADA MÁS
app.post("/api/webhook", express.raw({ type: "application/json" }), (req, res) => {
  console.log("✅✅✅ WEBHOOK MÍNIMO FUNCIONA ✅✅✅");
  console.log("🔔 Webhook recibido exitosamente");
  res.status(200).json({ status: "webhook_working", message: "¡Funciona!" });
});

// Health check básico
app.get("/", (req, res) => {
  res.json({ message: "Servidor mínimo funcionando" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor MÍNIMO en puerto ${PORT}`);
  console.log(`🔗 Webhook: http://localhost:${PORT}/api/webhook`);
});