const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken, authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const twilioRoleService = require('../services/twilioRoleService');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Ensure name is never null or empty
    const userName = name && name.trim() ? name.trim() : 'Expert';
    const userRole = role || 'expert';

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with explicit name validation
    const result = await db.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at',
      [email, hashedPassword, userName, userRole]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    // Create Twilio user with appropriate role
    try {
      await twilioRoleService.createTwilioUserWithRole(user.email);
      console.log(`✅ Created Twilio user with role for: ${user.email}`);
    } catch (twilioError) {
      console.error('❌ Failed to create Twilio user role:', twilioError);
      // Don't fail registration if Twilio role assignment fails
    }
    console.log('✅ User registered successfully:', user.email);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    
    if (error.message.includes('Database unavailable')) {
      return res.status(503).json({ 
        message: 'Database connection failed - Supabase project may be paused. Please check your Supabase dashboard.',
        error: 'SERVICE_UNAVAILABLE'
      });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt for:', email);

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const result = await db.query(
      'SELECT id, email, password_hash, name, role, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    console.log('✅ Login successful for:', email);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    
    if (error.message.includes('Database unavailable')) {
      return res.status(503).json({ 
        message: 'Database connection failed - Supabase project may be paused. Please check your Supabase dashboard.',
        error: 'SERVICE_UNAVAILABLE'
      });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    user: req.user
  });
});

// Logout (client-side token removal)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logout successful' });
});

module.exports = router;