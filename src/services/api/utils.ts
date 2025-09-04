import { API_BASE_URL, handleResponse } from './core';

export const utilsApi = {
  // Enhanced health check with detailed status
  async checkHealth() {
    console.log('🏥 Checking API health...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ API health check passed');
      return { healthy: true, ...data };
    } catch (error) {
      console.error('❌ API health check failed:', error);
      return { healthy: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Validate backend connection
  async validateConnection() {
    console.log('🔍 Validating backend connection...');
    
    try {
      const health = await this.checkHealth();
      
      if (!health.healthy) {
        throw new Error('Backend health check failed');
      }
      
      console.log('✅ Backend connection validated');
      return true;
    } catch (error) {
      console.error('❌ Backend connection validation failed:', error);
      throw new Error('Unable to connect to backend API. Please check your network connection and backend status.');
    }
  },

  // Get API base URL for debugging
  getApiBaseUrl() {
    return API_BASE_URL;
  },
};