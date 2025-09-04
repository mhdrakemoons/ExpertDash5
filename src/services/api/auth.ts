import { API_BASE_URL, handleResponse, retryRequest } from './core';

export const authApi = {
  async login(email: string, password: string) {
    console.log('🔐 Attempting login for:', email);
    
    const response = await retryRequest(() => 
      fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })
    );

    const data = await handleResponse(response);
    console.log('✅ Login successful for:', email);
    return data;
  },

  async register(email: string, password: string, name: string, role: string) {
    console.log('📝 Attempting registration for:', email);
    
    const response = await retryRequest(() =>
      fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name, role }),
      })
    );

    const data = await handleResponse(response);
    console.log('✅ Registration successful for:', email);
    return data;
  },

  async testAuthToken(token: string) {
    console.log('🔐 Testing auth token...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Token validation failed');
      }

      const data = await response.json();
      console.log('✅ Auth token is valid');
      return data;
    } catch (error) {
      console.error('❌ Auth token test failed:', error);
      throw error;
    }
  },
};