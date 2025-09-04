const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://expertdash5.onrender.com';

// Debug: Log the API URL being used
console.log('🔗 API_BASE_URL:', API_BASE_URL);
console.log('🔗 VITE_API_BASE_URL from env:', import.meta.env.VITE_API_BASE_URL);

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Enhanced error handling helper
export const handleResponse = async (response: Response) => {
  if (!response.ok) {
    let errorData: any = {};
    
    try {
      errorData = await response.json();
    } catch (parseError) {
      // If response is not JSON, use status text
      errorData = { message: response.statusText };
    }
    
    throw new ApiError(
      response.status, 
      errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      errorData.error || errorData.code
    );
  }
  
  return response.json();
};

// Enhanced retry logic for network issues
export const retryRequest = async (requestFn: () => Promise<Response>, maxRetries = 3, delay = 1000): Promise<Response> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await requestFn();
      return response;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on client errors (4xx)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        break;
      }
      
      console.log(`🔄 Request attempt ${attempt} failed, retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  
  throw lastError!;
};

export { API_BASE_URL };