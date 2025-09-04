const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Ensure CORS headers on auth failures
    const origin = req.get('Origin');
    if (origin) {
      // Use same whitelist logic as main server
      const WHITELIST = new Set([
        'http://localhost:5173',
        'http://localhost:3000',
        'https://baboo-dashboard.netlify.app',
        'https://calm-heliotrope-f996ab.netlify.app'
      ]);
      
      let allowOrigin = false;
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
        res.setHeader('Vary', 'Origin');
      }
    }
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists
    const userResult = await db.query(
      'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    // Ensure CORS headers on auth failures
    const origin = req.get('Origin');
    if (origin) {
      // Use same whitelist logic as main server
      const WHITELIST = new Set([
        'http://localhost:5173',
        'http://localhost:3000',
        'https://baboo-dashboard.netlify.app',
        'https://calm-heliotrope-f996ab.netlify.app'
      ]);
      
      let allowOrigin = false;
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
        res.setHeader('Vary', 'Origin');
      }
    }
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET
      );
};

module.exports = {
  authenticateToken,
  generateToken
};