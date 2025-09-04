import { API_BASE_URL, handleResponse, retryRequest } from './core';

export const googleSheetsApi = {
  async getGoogleSheetData(sheetName: string, token: string) {
    console.log(`📊 Fetching Google Sheet data for sheet: ${sheetName}`);
    
    const response = await retryRequest(() =>
      fetch(`${API_BASE_URL}/api/sheets/data/${encodeURIComponent(sheetName)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })
    );

    const data = await handleResponse(response);
    console.log(`✅ Google Sheet data received for ${sheetName}:`, data.meta?.rowCount || 0, 'rows');
    return data.data;
  },

  async getGoogleSheetNames(token: string) {
    console.log('📋 Fetching Google Sheet names...');
    
    const response = await retryRequest(() =>
      fetch(`${API_BASE_URL}/api/sheets/sheets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })
    );

    const data = await handleResponse(response);
    console.log('✅ Google Sheet names received:', data.data?.length || 0);
    return data.data;
  },

  async getGoogleSheetsStatus(token: string) {
    console.log('🔍 Checking Google Sheets service status...');
    
    const response = await retryRequest(() =>
      fetch(`${API_BASE_URL}/api/sheets/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })
    );

    const data = await handleResponse(response);
    console.log('✅ Google Sheets status received:', data.data);
    return data.data;
  },
};