const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('express-async-errors'); // Catch async errors in route handlers
require('dotenv').config();

const authRoutes = require('./routes/auth');
const twilioRoutes = require('./routes/twilio');
const inquiryRoutes = require('./routes/inquiries');
const externalRoutes = require('./routes/external');
const webhookRoutes = require('./routes/webhooks');
const googleSheetsRoutes = require('./routes/googleSheets');
const twilioRoleService = require('./services/twilioRoleService');
const adminRoutes = require('./routes/admin');
const conversationRoutes = require('./routes/conversations');
const expertAcceptanceRoutes = require('./routes/expertAcceptance');

const app = express();
const PORT = process.env.PORT || 8080;

// CORS configuration - simplified and more robust
const WHITELIST = new Set([
  'http://localhost:5173',
  'http://localhost:3000',
  'https://baboo-dashboard.netlify.app',
  'https://calm-heliotrope-f996ab.netlify.app'
]);

console.log('🔧 CORS configuration:', {
  whitelist: Array.from(WHITELIST),
  frontendUrl: process.env.FRONTEND_URL || 'NOT SET'
});

// Always include Vary: Origin so caches don't mix responses across origins
app.use((req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});

// Enhanced CORS configuration to handle preflight requests properly - MUST BE FIRST
app.use(cors({
  origin(origin, callback) {
    if (!origin || WHITELIST.has(origin)) {
      console.log('✅ CORS allowed for origin:', origin || 'no-origin');
      return callback(null, true);
    }
    
    // Check if it's a netlify.app domain
    try {
      if (/(^|\.)netlify\.app$/.test(new URL(origin).hostname)) {
        console.log('✅ CORS allowed for Netlify origin:', origin);
        return callback(null, true);
      }
    } catch (e) {
      // Invalid URL, fall through to deny
    }
    
    console.log('❌ CORS blocked origin:', origin);
    console.log('📋 Allowed origins:', Array.from(WHITELIST));
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length'],
  optionsSuccessStatus: 204,
}));

// Security middleware (after CORS)
app.use(helmet());

// Rate limiting (skip preflight OPTIONS to prevent blocking CORS)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Very high limit for messaging app - 10000 requests per 15 minutes
  message: JSON.stringify({ 
    message: 'Too many requests from this IP, please try again later.',
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 15 * 60 // seconds
  }),
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for:
    // 1. OPTIONS requests (CORS preflight)
    // 2. Health check endpoint
    // 3. ALL authenticated API requests (has Authorization header)
    // 4. Webhook endpoints (external services)
    // 5. Twilio endpoints (high frequency messaging)
    const isAuthenticated = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
    const isWebhook = req.path.startsWith('/api/webhooks');
    const isTwilio = req.path.startsWith('/api/twilio');
    const isHealthCheck = req.path === '/api/health';
    const isOptions = req.method === 'OPTIONS';
    
    const skipRateLimit = isOptions || 
                         isHealthCheck ||
                         isAuthenticated ||
                         isWebhook ||
                         isTwilio;
    
    if (skipRateLimit) {
      console.log(`⏭️ Skipping rate limit for ${req.method} ${req.path} (auth: ${!!isAuthenticated}, webhook: ${isWebhook}, twilio: ${isTwilio})`);
    }
    
    return skipRateLimit;
  },
  // Custom handler to ensure JSON response
  handler: (req, res) => {
    console.log(`🚫 Rate limit exceeded for ${req.method} ${req.path} from IP: ${req.ip}`);
    res.status(429).json({
      message: 'Too many requests from this IP, please try again later.',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    });
  }
});
app.use(limiter);

// Remove the explicit OPTIONS handler - let CORS middleware handle it
// The explicit handler was conflicting with the CORS middleware

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/twilio', twilioRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/external', externalRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/sheets', googleSheetsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/expert-acceptance', expertAcceptanceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware - ensure CORS headers are present even on errors
app.use((err, req, res, next) => {
  const origin = req.get('Origin');
  let allowOrigin = false;
  
  if (origin) {
    if (WHITELIST.has(origin)) {
      allowOrigin = true;
    } else {
      try {
        if (/(^|\.)netlify\.app$/.test(new URL(origin).hostname)) {
          allowOrigin = true;
        }
      } catch (e) {
        // Invalid URL, don't allow
      }
    }
    
    if (allowOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length');
      const reqHeaders = req.get('Access-Control-Request-Headers');
      if (reqHeaders) {
        res.setHeader('Access-Control-Allow-Headers', reqHeaders);
      }
      res.setHeader('Vary', 'Origin');
    }
  }

  console.error('❌ Error caught by middleware:', err.message);
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.stack
  });
});

// 404 handler - include CORS for allowed origins
app.use('*', (req, res) => {
  const origin = req.get('Origin');
  let allowOrigin = false;
  
  if (origin) {
    if (WHITELIST.has(origin)) {
      allowOrigin = true;
    } else {
      try {
        if (/(^|\.)netlify\.app$/.test(new URL(origin).hostname)) {
          allowOrigin = true;
        }
      } catch (e) {
        // Invalid URL, don't allow
      }
    }
    
    if (allowOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length');
      res.setHeader('Vary', 'Origin');
    }
  }
  res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  
  // Initialize bot roles on server start
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    console.log(`🤖 Initializing bot roles in Twilio...`);
    twilioRoleService.ensureBotRoles().catch(error => {
      console.error('❌ Failed to initialize bot roles:', error);
    });
  }
  
  console.log(`📡 Webhook endpoints available:`);
  console.log(`  POST http://localhost:${PORT}/api/webhooks/message-added`);
  console.log(`  POST http://localhost:${PORT}/api/webhooks/conversation-state-updated`);
  console.log(`  POST http://localhost:${PORT}/api/webhooks/participant-added`);
  console.log(`  POST http://localhost:${PORT}/api/webhooks/conversation-added`);
  console.log(`  POST http://localhost:${PORT}/api/webhooks/twilio-event`);
  console.log(`🔐 Auth endpoints:`);
  console.log(`  POST http://localhost:${PORT}/api/auth/login`);
  console.log(`  POST http://localhost:${PORT}/api/auth/register`);
});

module.exports = app;