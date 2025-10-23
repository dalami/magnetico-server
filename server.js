// -------------------------
// server.js - CONFIGURADO PARA DONWEB
// -------------------------
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

// 🔹 Rutas
import configRoutes from './routes/config.js';
import adminRoutes from './routes/admin.js';
import orderRoutes from './routes/order.js';

// -------------------------
// Configuración para ES modules
// -------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------
// Configuración inicial
// -------------------------
const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;

// -------------------------
// Trust proxy (para DonWeb)
// -------------------------
app.set('trust proxy', 1);

// -------------------------
// Middlewares de seguridad
// -------------------------
app.use(helmet({
  contentSecurityPolicy: false, // Simplificado para DonWeb
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

// -------------------------
// Logging
// -------------------------
app.use(morgan(isProduction ? 'combined' : 'dev'));

// -------------------------
// Rate Limiting (más permisivo para DonWeb)
// -------------------------
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 🔥 AUMENTA TEMPORALMENTE a 1000
  message: { error: 'Demasiadas solicitudes, intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  // 🔥 AGREGAR para debug
  handler: (req, res) => {
    console.log('🚫 Rate limit exceeded for IP:', req.ip);
    res.status(429).json({ error: 'Demasiadas solicitudes, intenta más tarde.' });
  }
});
// -------------------------
// Configuración CORS para DonWeb
// -------------------------
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://magnetico-fotoimanes.com';
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  FRONTEND_URL,
  'https://www.magnetico-fotoimanes.com',
  'https://magnetico-fotoimanes.com'
].filter(Boolean);

console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 FRONTEND_URL permitido: ${FRONTEND_URL}`);
console.log(`🏠 Dominios DonWeb permitidos: magnetico-fotoimanes.com`);

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      return callback(null, true);
    }
    
    // En producción, permitir subdominios de tu dominio REAL
    if (isProduction && origin.includes('magnetico-fotoimanes.com')) {
      return callback(null, true);
    }
    
    console.warn(`🚫 Origen bloqueado: ${origin}`);
    return callback(new Error('No permitido por CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-requested-with'],
  maxAge: 86400
}));

// -------------------------
// Middlewares de parsing
// -------------------------
app.use(express.json({ 
  limit: '20mb', // Aumentado para DonWeb
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// -------------------------
// Servir archivos estáticos (si tienes)
// -------------------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// -------------------------
// Health checks mejorados para DonWeb
// -------------------------
app.get('/', (_req, res) => {
  res.json({ 
    message: '🟢 Magnetico API Online - DonWeb',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    server: 'DonWeb',
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV,
    server: 'DonWeb'
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

console.log('✅ Rutas cargadas: /api/send-photos, /api/config, /api/admin');

// -------------------------
// Webhook MP (raw body)
// -------------------------
app.post('/api/webhook',      // ✅ CORRECTO: usar 'app' en lugar de 'router'
  express.raw({ type: "application/json", limit: "1mb" }), 
  async (req, res) => {
    try {
      console.log('🟢 Webhook MP recibido:', {
        headers: req.headers,
        timestamp: new Date().toISOString()
      });

      const signature = req.headers['x-signature'];
      const requestId = req.headers['x-request-id'];
      const payload = req.body.toString();
      const data = JSON.parse(payload);

      // 🔥 VALIDACIÓN DE FIRMA (requerida por MP)
      if (signature) {
        // Extraer ts y v1 del signature
        const parts = signature.split(',');
        let ts, v1;
        parts.forEach(part => {
          const [key, value] = part.split('=');
          if (key === 'ts') ts = value;
          if (key === 'v1') v1 = value;
        });

        // TODO: Implementar validación HMAC con tu secret key de MP
        console.log('🔐 Signature validation needed:', { ts, v1, requestId });
      }

      // Procesar el evento
      if (data.type === 'payment') {
        const paymentId = data.data.id;
        console.log(`💰 Payment event: ${paymentId}, Action: ${data.action}`);
        
        // Aquí actualizás el estado de tu pedido
        // Buscar por external_reference = tu orderId
      }

      // 🔥 RESPONDER INMEDIATAMENTE (MP espera < 22 segundos)
      res.status(200).json({ status: 'webhook received' });
      
    } catch (error) {
      console.error('❌ Error en webhook:', error);
      res.status(400).json({ error: 'Invalid webhook' });
    }
  }
);
// -------------------------
// Manejo de rutas no encontradas
// -------------------------
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    server: 'DonWeb'
  });
});

// -------------------------
// Manejo global de errores
// -------------------------
app.use((error, req, res, next) => {
  console.error('🔥 Error global en DonWeb:', {
    message: error.message,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON malformado' });
  }

  if (error.message.includes('CORS')) {
    return res.status(403).json({ error: 'Origen no permitido' });
  }

  if (error.status === 429) {
    return res.status(429).json({ error: 'Demasiadas solicitudes' });
  }

  const statusCode = error.status || error.statusCode || 500;
  const response = {
    error: isProduction && statusCode === 500 ? 'Error interno del servidor' : error.message,
    server: 'DonWeb'
  };

  if (!isProduction) {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
});

// -------------------------
// Iniciar servidor
// -------------------------
const server = app.listen(PORT, '0.0.0.0', () => { // 🔥 IMPORTANTE: '0.0.0.0' para DonWeb
  console.log(`
🚀 Servidor Magnetico iniciado EN DONWEB
📍 Puerto: ${PORT}
🌍 Host: 0.0.0.0
🏠 Entorno: ${process.env.NODE_ENV || 'development'}
📅 Iniciado: ${new Date().toISOString()}
  `);
});

// -------------------------
// Manejo graceful shutdown para DonWeb
// -------------------------
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recibido, cerrando servidor gracefully...');
  server.close(() => {
    console.log('✅ Servidor cerrado');
    process.exit(0);
  });
});

export default app;