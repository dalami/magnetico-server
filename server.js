// -------------------------
// server.js - CORREGIDO
// -------------------------
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import createError from 'http-errors';

// 🔹 Rutas ACTUALIZADAS (sin payRoutes)
import configRoutes from './routes/config.js';
import adminRoutes from './routes/admin.js';
import orderRoutes from './routes/order.js';

// -------------------------
// Configuración inicial
// -------------------------
const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;

// -------------------------
// Trust proxy (para Render/Vercel/Heroku)
// -------------------------
app.set('trust proxy', 1);

// -------------------------
// Middlewares de seguridad
// -------------------------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

// -------------------------
// Logging
// -------------------------
app.use(morgan(isProduction ? 'combined' : 'dev'));

// -------------------------
// Rate Limiting
// -------------------------
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: { error: 'Demasiadas solicitudes, intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// -------------------------
// Configuración CORS segura
// -------------------------
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://magnetico-app.vercel.app').replace(/\/+$/, '');
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  FRONTEND_URL
].filter(Boolean);

console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 FRONTEND_URL permitido: ${FRONTEND_URL}`);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || 
        (isProduction && origin.endsWith('.vercel.app')) ||
        (isProduction && origin.endsWith('.onrender.com'))) {
      return callback(null, true);
    }
    
    console.warn(`🚫 Origen bloqueado: ${origin}`);
    return callback(new Error('No permitido por CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-requested-with'],
  maxAge: 86400 // 24 horas
}));

app.options('*', cors());

// -------------------------
// Middlewares de parsing
// -------------------------
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf; // Para webhooks
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// -------------------------
// Health checks y métricas
// -------------------------
app.get('/', (_req, res) => {
  res.json({ 
    message: '🟢 Magnetico API Online',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV
  });
});

// -------------------------
// Aplicar rate limiting
// -------------------------
app.use(generalLimiter);

// -------------------------
// Rutas modulares ACTUALIZADAS (sin /api/pay)
// -------------------------
app.use("/api/send-photos", orderRoutes); // ✅ Ahora incluye Mercado Pago
app.use("/api/config", configRoutes);
app.use("/api/admin", adminRoutes);
// ❌ ELIMINADO: app.use("/api/pay", payRoutes);

console.log('✅ Rutas cargadas: /api/send-photos, /api/config, /api/admin');

// -------------------------
// Webhook MP (raw body)
// -------------------------
app.post('/api/webhook', 
  express.raw({ type: "application/json", limit: "1mb" }), 
  (req, res) => {
    try {
      const signature = req.headers['x-signature'] || req.headers['x-webhook-signature'];
      const payload = req.body.toString();
      
      console.log('🟢 Webhook MP recibido:', {
        signature: signature ? 'present' : 'missing',
        payloadLength: payload.length,
        timestamp: new Date().toISOString()
      });

      // TODO: Validar firma del webhook
      
      res.status(200).json({ status: 'webhook received' });
    } catch (error) {
      console.error('❌ Error procesando webhook:', error);
      res.status(400).json({ error: 'Invalid webhook payload' });
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
    method: req.method 
  });
});

// -------------------------
// Manejo global de errores
// -------------------------
app.use((error, req, res, next) => {
  console.error('🔥 Error global:', {
    message: error.message,
    stack: error.stack,
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

  // Error de rate limit
  if (error.status === 429) {
    return res.status(429).json({ error: 'Demasiadas solicitudes' });
  }

  const statusCode = error.status || error.statusCode || 500;
  const response = {
    error: isProduction && statusCode === 500 ? 'Error interno del servidor' : error.message
  };

  if (!isProduction) {
    response.stack = error.stack;
    response.details = error.details;
  }

  res.status(statusCode).json(response);
});

// -------------------------
// Iniciar servidor
// -------------------------
const server = app.listen(PORT, () => {
  console.log(`
🚀 Servidor Magnetico iniciado
📍 Puerto: ${PORT}
🌍 Entorno: ${process.env.NODE_ENV || 'development'}
📅 Iniciado: ${new Date().toISOString()}
  `);
});

export default app;