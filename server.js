// -------------------------
// server.js - CONFIGURADO PARA DONWEB
// -------------------------
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

// 🔹 Rutas
import configRoutes from "./routes/config.js";
import adminRoutes from "./routes/admin.js";
import orderRoutes from "./routes/order.js";

// -------------------------
// Configuración para ES modules
// -------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------
// Configuración inicial
// -------------------------
const app = express();
const isProduction = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 5000;

// -------------------------
// Trust proxy (para DonWeb)
// -------------------------
app.set("trust proxy", 1);

// -------------------------
// Middlewares de seguridad
// -------------------------
app.use(
  helmet({
    contentSecurityPolicy: false, // Simplificado para DonWeb
    crossOriginEmbedderPolicy: false,
  })
);

app.use(compression());

// -------------------------
// Logging
// -------------------------
app.use(morgan(isProduction ? "combined" : "dev"));

// -------------------------
// Rate Limiting (más permisivo para DonWeb)
// -------------------------
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 🔥 AUMENTA TEMPORALMENTE a 1000
  message: { error: "Demasiadas solicitudes, intenta más tarde." },
  standardHeaders: true,
  legacyHeaders: false,
  // 🔥 AGREGAR para debug
  handler: (req, res) => {
    console.log("🚫 Rate limit exceeded for IP:", req.ip);
    res
      .status(429)
      .json({ error: "Demasiadas solicitudes, intenta más tarde." });
  },
});
// -------------------------
// Configuración CORS para DonWeb
// -------------------------
const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://magnetico-fotoimanes.com";
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  FRONTEND_URL,
  "https://www.magnetico-fotoimanes.com",
  "https://magnetico-fotoimanes.com",
].filter(Boolean);

console.log(`🌍 Entorno: ${process.env.NODE_ENV || "development"}`);
console.log(`🔗 FRONTEND_URL permitido: ${FRONTEND_URL}`);
console.log(`🏠 Dominios DonWeb permitidos: magnetico-fotoimanes.com`);

app.use(
  cors({
    origin: function (origin, callback) {
      // Permitir requests sin origin
      if (!origin) return callback(null, true);

      if (allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
        return callback(null, true);
      }

      // En producción, permitir subdominios de tu dominio REAL
      if (isProduction && origin.includes("magnetico-fotoimanes.com")) {
        return callback(null, true);
      }

      console.warn(`🚫 Origen bloqueado: ${origin}`);
      return callback(new Error("No permitido por CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-admin-key",
      "x-requested-with",
    ],
    maxAge: 86400,
  })
);

// -------------------------
// Middlewares de parsing
// -------------------------
app.use(
  express.json({
    limit: "20mb", // Aumentado para DonWeb
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// -------------------------
// Servir archivos estáticos (si tienes)
// -------------------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// -------------------------
// Health checks mejorados para DonWeb
// -------------------------
app.get("/", (_req, res) => {
  res.json({
    message: "🟢 Magnetico API Online - DonWeb",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    server: "DonWeb",
    version: process.env.npm_package_version || "1.0.0",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV,
    server: "DonWeb",
  });
});

// -------------------------
// Aplicar rate limiting
// -------------------------
app.use(generalLimiter);

// -------------------------
// Rutas modulares
// -------------------------
app.use("/api/send-photos", orderRoutes);
app.use("/api/config", configRoutes);
app.use("/api/admin", adminRoutes);

console.log("✅ Rutas cargadas: /api/send-photos, /api/config, /api/admin");

// -------------------------
// FUNCIONES DE EMAIL PARA PAGOS APROBADOS (AGREGAR AL server.js)
// -------------------------
import { Resend } from "resend";

// Configurar Resend
let resend;
try {
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      "⚠️ RESEND_API_KEY no configurada. Los emails no se enviarán."
    );
  } else {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log("✅ Resend configurado en server.js");
  }
} catch (error) {
  console.error("❌ Error configurando Resend:", error.message);
}

// 🔥 1. EMAIL DE PAGO APROBADO (para vos)
const sendPaymentApprovedEmail = async (paymentData) => {
  try {
    if (!resend) {
      console.log(
        "📧 Resend no configurado - Simulando email de pago aprobado"
      );
      console.log("💰 Pago aprobado:", paymentData);
      return true;
    }

    console.log("📧 Enviando email de pago aprobado...");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .order-details { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .status { color: #4CAF50; font-weight: bold; font-size: 1.2em; }
            .celebrate { background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>✅ PAGO APROBADO</h1>
            <p>Orden: ${paymentData.orderId}</p>
          </div>
          <div class="content">
            <div class="celebrate">
              <h2>🎉 ¡PAGO CONFIRMADO!</h2>
              <p style="font-size: 1.1em; margin: 10px 0;">El pedido está listo para procesar y enviar</p>
            </div>
            
            <div class="status">🟢 PAGO CONFIRMADO - PROCESAR PEDIDO</div>
            
            <h2>👤 Información del Cliente</h2>
            <p><strong>Nombre:</strong> ${paymentData.customerName}</p>
            <p><strong>Email:</strong> ${paymentData.customerEmail}</p>
            <p><strong>Teléfono:</strong> ${paymentData.customerPhone}</p>
            <p><strong>Dirección:</strong> ${paymentData.customerAddress}</p>
            
            <div class="order-details">
              <h2>💰 Información de Pago</h2>
              <p><strong>ID de Pago MP:</strong> ${paymentData.paymentId}</p>
              <p><strong>Monto:</strong> $${paymentData.amount}</p>
              <p><strong>Fecha de pago:</strong> ${new Date(
                paymentData.date
              ).toLocaleString("es-AR")}</p>
              <p><strong>Método:</strong> ${
                paymentData.paymentMethod || "No especificado"
              }</p>
            </div>

            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <h3>📦 Acción Requerida</h3>
              <p><strong>Procesar el pedido y preparar envío.</strong></p>
              <p>Orden: <strong>${paymentData.orderId}</strong></p>
            </div>

            <p style="text-align: center; margin-top: 25px; color: #666;">
              <em>Este es un email automático de confirmación de pago.</em>
            </p>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "Magnético Fotoimanes <pedidos@magnetico-fotoimanes.com>",
      to: "pedidos@magnetico-fotoimanes.com",
      subject: `✅ PAGO APROBADO - ${paymentData.orderId} - $${paymentData.amount}`,
      html: emailHtml,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log(`✅ Email de pago aprobado enviado: ${paymentData.orderId}`);
    return true;
  } catch (error) {
    console.error("❌ Error enviando email de pago aprobado:", error.message);
    return false;
  }
};

// 🔥 2. EMAIL DE CONFIRMACIÓN AL CLIENTE (pago aprobado)
const sendCustomerPaymentConfirmation = async (customerData) => {
  try {
    if (!resend) {
      console.log("📧 Resend no configurado - Simulando email al cliente");
      return true;
    }

    console.log("📧 Enviando confirmación de pago al cliente...");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .order-details { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .status { color: #4CAF50; font-weight: bold; }
            .celebrate { background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>¡Pago Confirmado! 🎉</h1>
            <p>Tu pedido está siendo procesado</p>
          </div>
          <div class="content">
            <div class="celebrate">
              <h2>¡Gracias por tu compra!</h2>
              <p style="font-size: 1.1em; margin: 10px 0;">Tu pago ha sido confirmado exitosamente</p>
            </div>
            
            <h2>Hola ${customerData.customerName},</h2>
            <p class="status">✅ Tu pago ha sido confirmado exitosamente.</p>
            
            <div class="order-details">
              <h3>📋 Resumen de tu pedido</h3>
              <p><strong>Número de orden:</strong> ${customerData.orderId}</p>
              <p><strong>ID de pago:</strong> ${customerData.paymentId}</p>
              <p><strong>Total pagado:</strong> $${customerData.amount}</p>
              <p><strong>Fecha de pago:</strong> ${new Date(
                customerData.date
              ).toLocaleString("es-AR")}</p>
              <p><strong>Método de pago:</strong> ${
                customerData.paymentMethod || "Tarjeta"
              }</p>
            </div>

            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>📦 Estado de tu pedido</h3>
              <p><strong>Estado:</strong> <span style="color: #4CAF50; font-weight: bold;">✅ PAGO CONFIRMADO - EN PROCESAMIENTO</span></p>
              <p>Estamos preparando tus fotoimanes con mucho cuidado.</p>
            </div>

            <p><strong>¿Qué sigue?</strong></p>
            <ul>
              <li>Estamos procesando tus fotoimanes</li>
              <li>Recibirás una notificación cuando sean enviados</li>
              <li>Tiempo de procesamiento: 24-48 horas</li>
              <li>Te contactaremos para coordinar el envío</li>
            </ul>

            <p>Si tenés alguna pregunta, respondé a este email.</p>
            
            <p>¡Gracias por confiar en nosotros!<br>El equipo de <strong>Magnético Fotoimanes</strong></p>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "Magnético Fotoimanes <pedidos@magnetico-fotoimanes.com>",
      to: customerData.customerEmail,
      subject: `✅ Pago Confirmado - Pedido ${customerData.orderId}`,
      html: emailHtml,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log(
      `✅ Email de confirmación de pago enviado al cliente: ${customerData.orderId}`
    );
    return true;
  } catch (error) {
    console.error(
      "❌ Error enviando confirmación de pago al cliente:",
      error.message
    );
    return false;
  }
};
// -------------------------
// Webhook MP CORREGIDO en server.js
// -------------------------
app.post(
  "/api/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req, res) => {
    console.log("🔔🔔🔔 WEBHOOK MP LLAMADO - INICIO 🔔🔔🔔");
    console.log("📋 HEADERS:", req.headers);

    try {
      const payload = req.body.toString();
      const data = JSON.parse(payload);

      console.log("📦 BODY COMPLETO:", JSON.stringify(data, null, 2));
      console.log("🎯 Tipo de webhook:", data.type);

      if (data.type === "payment") {
        const paymentId = data.data.id;
        console.log(`💰 Procesando pago: ${paymentId}`);

        // Obtener detalles del pago
        const response = await axios.get(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
            },
          }
        );

        const payment = response.data;
        const orderId = payment.external_reference;

        console.log(`📋 Estado del pago ${paymentId}: ${payment.status}`);
        console.log(`📦 Orden asociada: ${orderId}`);

        if (payment.status === "approved") {
          console.log(`✅✅✅ PAGO APROBADO DETECTADO ✅✅✅`);

          const paymentData = {
            orderId: orderId,
            paymentId: paymentId,
            amount: payment.transaction_amount,
            date: payment.date_approved,
            paymentMethod: payment.payment_method_id,
            customerName: `${payment.payer.first_name} ${payment.payer.last_name}`,
            customerEmail: payment.payer.email,
            customerPhone: payment.payer.phone?.number || "No proporcionado",
            customerAddress:
              `${payment.payer.address?.street_name || ""} ${
                payment.payer.address?.street_number || ""
              }`.trim() || "No proporcionada",
          };

          console.log("📧📧📧 INICIANDO ENVÍO DE EMAILS 📧📧📧");

          // Email para vos
          const result1 = await sendPaymentApprovedEmail(paymentData);
          console.log(`📧 Email a pedidos@: ${result1 ? "✅" : "❌"}`);

          // Email para el cliente
          const result2 = await sendCustomerPaymentConfirmation(paymentData);
          console.log(`📧 Email al cliente: ${result2 ? "✅" : "❌"}`);

          console.log(`🎉🎉🎉 PROCESO COMPLETADO - Emails enviados 🎉🎉🎉`);
        }
      }

      console.log("🔔🔔🔔 WEBHOOK MP PROCESADO - FIN 🔔🔔🔔");
      res.status(200).json({ status: "webhook received" });
    } catch (error) {
      console.error("💥💥💥 ERROR CRÍTICO EN WEBHOOK:", error.message);
      console.error("Stack:", error.stack);
      res.status(200).json({ status: "error", message: error.message });
    }
  }
);
// -------------------------
// Manejo de rutas no encontradas
// -------------------------
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    path: req.originalUrl,
    method: req.method,
    server: "DonWeb",
  });
});

// -------------------------
// Manejo global de errores
// -------------------------
app.use((error, req, res, next) => {
  console.error("🔥 Error global en DonWeb:", {
    message: error.message,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON malformado" });
  }

  if (error.message.includes("CORS")) {
    return res.status(403).json({ error: "Origen no permitido" });
  }

  if (error.status === 429) {
    return res.status(429).json({ error: "Demasiadas solicitudes" });
  }

  const statusCode = error.status || error.statusCode || 500;
  const response = {
    error:
      isProduction && statusCode === 500
        ? "Error interno del servidor"
        : error.message,
    server: "DonWeb",
  };

  if (!isProduction) {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
});

// -------------------------
// Iniciar servidor
// -------------------------
const server = app.listen(PORT, "0.0.0.0", () => {
  // 🔥 IMPORTANTE: '0.0.0.0' para DonWeb
  console.log(`
🚀 Servidor Magnetico iniciado EN DONWEB
📍 Puerto: ${PORT}
🌍 Host: 0.0.0.0
🏠 Entorno: ${process.env.NODE_ENV || "development"}
📅 Iniciado: ${new Date().toISOString()}
  `);
});

// -------------------------
// Manejo graceful shutdown para DonWeb
// -------------------------
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM recibido, cerrando servidor gracefully...");
  server.close(() => {
    console.log("✅ Servidor cerrado");
    process.exit(0);
  });
});

export default app;
