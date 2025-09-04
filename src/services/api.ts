// Main API service that combines all modules
import { authApi } from './api/auth';
import { twilioApi } from './api/twilio';
import { conversationsApi } from './api/conversations';
import { inquiriesApi } from './api/inquiries';
import { googleSheetsApi } from './api/googleSheets';
import { adminApi } from './api/admin';
import { expertAcceptanceApi } from './api/expertAcceptance';
import { utilsApi } from './api/utils';

// Combine all API modules into a single service
export const apiService = {
  // Auth methods
  ...authApi,
  
  // Twilio methods  
  getTwilioToken: twilioApi.getTwilioToken,
  sendExternalMessage: twilioApi.sendMessage,
  
  // Conversation methods
  getMainConversations: conversationsApi.getMainConversations,
  getConversationParticipants: conversationsApi.getConversationParticipants,
  getConversationMessages: conversationsApi.getConversationMessages,
  getExpertAdminDMs: conversationsApi.getExpertAdminDMs,
  getAdminTravelerDMs: conversationsApi.getAdminTravelerDMs,
  
  // Inquiry methods
  createInquiry: inquiriesApi.createInquiry,
  getExperts: inquiriesApi.getExperts,
  getInquiries: inquiriesApi.getInquiries,
  updateInquiryStatus: inquiriesApi.updateInquiryStatus,
  
  // Google Sheets methods
  getGoogleSheetData: googleSheetsApi.getGoogleSheetData,
  getGoogleSheetNames: googleSheetsApi.getGoogleSheetNames,
  getGoogleSheetsStatus: googleSheetsApi.getGoogleSheetsStatus,
  
  // Admin methods
  sendMessageToTraveler: adminApi.sendMessageToTraveler,
  updateBotSettings: adminApi.updateBotSettings,
  getBotSettings: adminApi.getBotSettings,
  getWebhookStatus: adminApi.getWebhookStatus,
  sendMessageToTravelerDM: adminApi.sendMessageToTravelerDM,
  
  // Expert acceptance methods
  getPendingConversations: expertAcceptanceApi.getPendingConversations,
  acceptConversation: expertAcceptanceApi.acceptConversation,
  getConversationDetails: expertAcceptanceApi.getConversationDetails,
  checkConversationAcceptance: expertAcceptanceApi.checkConversationAcceptance,
  acceptConversationBySid: expertAcceptanceApi.acceptConversationBySid,
  getConversationDetailsBySid: expertAcceptanceApi.getConversationDetailsBySid,
  
  // Utility methods
  checkHealth: utilsApi.checkHealth,
  validateConnection: utilsApi.validateConnection,
  testAuthToken: authApi.testAuthToken,
  getApiBaseUrl: utilsApi.getApiBaseUrl,
};