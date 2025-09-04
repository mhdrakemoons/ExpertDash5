const { Pool } = require('pg');
require('dotenv').config();

console.log('🗄️  Database connection details:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10
});

// Test the connection with better error handling
pool.on('connect', () => {
  console.log('✅ Connected to the PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err.message);
  if (err.code === 'ENOTFOUND') {
    console.error('📡 DNS Resolution failed - Supabase project may be paused or hostname is incorrect');
    console.error('🔍 Check if your Supabase project is active at: https://supabase.com/dashboard');
  }
});

// Test connection on startup
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connection test successful');
    client.release();
  } catch (err) {
    console.error('❌ Database connection test failed:', err.message);
    if (err.code === 'ENOTFOUND') {
      console.error('🚨 SUPABASE PROJECT ISSUE:');
      console.error('   - Your Supabase project may be paused (free tier projects pause after inactivity)');
      console.error('   - Visit https://supabase.com/dashboard to check your project status');
      console.error('   - If paused, simply visit your project dashboard to reactivate it');
    }
  }
};

// Run connection test
testConnection();

module.exports = {
  query: async (text, params) => {
    try {
      return await pool.query(text, params);
    } catch (error) {
      if (error.code === 'ENOTFOUND') {
        throw new Error('Database unavailable - Supabase project may be paused. Please check your Supabase dashboard.');
      }
      throw error;
    }
  },
  pool
};