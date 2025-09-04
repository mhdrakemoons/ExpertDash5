import { API_BASE_URL, handleResponse, retryRequest } from './core';

export const inquiriesApi = {
  async createInquiry(inquiry: {
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    message: string;
    assignedExpertId: string;
  }, token: string) {
    console.log('📝 Creating inquiry for customer:', inquiry.customerName);
    
    const response = await retryRequest(() =>
      fetch(`${API_BASE_URL}/api/inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(inquiry),
      })
    );

    const data = await handleResponse(response);
    console.log('✅ Inquiry created successfully:', data.data?.id);
    return data;
  },

  async getExperts(token: string) {
    console.log('👥 Fetching experts list...');
    
    const response = await retryRequest(() =>
      fetch(`${API_BASE_URL}/api/inquiries/experts/list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })
    );

    const data = await handleResponse(response);
    console.log('✅ Experts list received:', data.data?.length || 0);
    return data;
  },

  async getInquiries(token: string, page: number = 1, limit: number = 10) {
    console.log(`📋 Fetching inquiries (page ${page}, limit ${limit})...`);
    
    const response = await retryRequest(() =>
      fetch(`${API_BASE_URL}/api/inquiries?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })
    );

    const data = await handleResponse(response);
    console.log('✅ Inquiries received:', data.data?.length || 0);
    return data;
  },

  async updateInquiryStatus(inquiryId: string, status: string, token: string) {
    console.log(`🔄 Updating inquiry ${inquiryId} status to:`, status);
    
    const response = await retryRequest(() =>
      fetch(`${API_BASE_URL}/api/inquiries/${inquiryId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      })
    );

    const data = await handleResponse(response);
    console.log('✅ Inquiry status updated successfully');
    return data;
  },
};