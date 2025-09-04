import { API_BASE_URL, handleResponse, retryRequest } from './core';

export const twilioApi = {
  async getTwilioToken(identity: string, token: string) {
    console.log('🎫 Requesting Twilio token for:', identity);
    
    const response = await retryRequest(() =>
      fetch(`${API_BASE_URL}/api/twilio/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ identity }),
      })
    );

    const data = await handleResponse(response);
    console.log('✅ Twilio token received');
    return data.token;
  },

  async sendMessage(
    conversationSid: string,
    message: string,
    author: string,
    token: string,
    from?: string
  ) {
    console.log(`📤 Sending message to backend API:`, {
      conversationSid,
      messagePreview: message.substring(0, 50),
      author,
      from
    });
    
    const requestBody: any = {
      conversationSid,
      message,
      author,
    };
    
    if (from) {
      requestBody.from = from;
    }
    
    const response = await retryRequest(() =>
      fetch(`${API_BASE_URL}/api/twilio/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      })
    );

    const data = await handleResponse(response);
    console.log('✅ Backend API confirmed message sent:', {
      messageSid: data.data?.sid,
      conversationSid: data.data?.conversationSid,
      author: data.data?.author
    });
    return data;
  },
};