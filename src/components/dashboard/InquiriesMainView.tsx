import React, { useState, useEffect } from 'react';
import { MessageSquare, User, Clock, CheckCircle, RefreshCw, AlertCircle, Eye, Mail, Phone, Calendar } from 'lucide-react';
import { ConversationAcceptanceModal } from './ConversationAcceptanceModal';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface PendingConversation {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  message: string;
  conversation_sid: string;
  status: string;
  created_at: string;
  updated_at: string;
  expert_accepted: boolean;
  expert_accepted_at?: string;
  auto_accepted: boolean;
}

interface InquiriesMainViewProps {
  onConversationAccepted?: () => void;
  onConversationClick?: (conversationSid: string) => void;
}

export function InquiriesMainView({ onConversationAccepted, onConversationClick }: InquiriesMainViewProps) {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<PendingConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<PendingConversation | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const loadConversations = async () => {
    if (!token) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.getPendingConversations(token);
      const allConversations = response.conversations || [];
      
      // Filter to show only inquiries from August 18, 2025 onwards (UTC)
      const aug18_2025_utc = new Date('2025-08-18T00:00:00.000Z');
      const filteredConversations = allConversations.filter(conversation => {
        const createdAt = new Date(conversation.created_at);
        return createdAt >= aug18_2025_utc;
      });
      
      setConversations(filteredConversations);
      
      console.log(`✅ Loaded ${allConversations.length} total conversations, showing ${filteredConversations.length} from Aug 18, 2025 onwards`);
      
    } catch (err) {
      console.error('❌ Failed to load conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [token]);

  const handleConversationClick = (conversation: PendingConversation) => {
    // If conversation is accepted, navigate to conversations tab
    if (conversation.expert_accepted) {
      if (onConversationClick) {
        onConversationClick(conversation.conversation_sid);
      }
    } else {
      // If not accepted, show acceptance modal
      setSelectedConversation(conversation);
    }
  };

  const handleAcceptConversation = async (conversationId: string) => {
    if (!token) return;
    
    try {
      setIsAccepting(true);
      
      await apiService.acceptConversation(conversationId, token);
      
      // Refresh the conversation list
      await loadConversations();
      
      // Notify parent component
      if (onConversationAccepted) {
        onConversationAccepted();
      }
      
      console.log('✅ Conversation accepted successfully');
      
    } catch (err) {
      console.error('❌ Failed to accept conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept conversation');
    } finally {
      setIsAccepting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(dateString));
  };

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const pendingCount = conversations.filter(c => !c.expert_accepted).length;
  const acceptedCount = conversations.filter(c => c.expert_accepted).length;

  return (
    <div className="flex-1 flex flex-col bg-white h-full">
      {/* Header */}
      <div className="border-b border-gray-200 p-8 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <MessageSquare className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Inquiries Dashboard</h1>
              <p className="text-lg text-gray-600 mt-1">Review and accept assigned conversations</p>
            </div>
            <div className="flex items-center gap-4">
              {pendingCount > 0 && (
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                  {pendingCount} pending acceptance
                </span>
              )}
              {acceptedCount > 0 && (
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  {acceptedCount} accepted
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={loadConversations}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 text-lg"
            title="Refresh inquiries"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="text-lg">Loading inquiries...</span>
            </div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-16 h-16 mx-auto mb-6 text-gray-300" />
            <h3 className="text-xl font-medium mb-2">No Inquiries Assigned</h3>
            <p className="text-gray-600 mb-4">You don't have any conversations assigned to you yet.</p>
            <div className="max-w-md mx-auto p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">What happens next:</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• Admins will assign customer inquiries to you</p>
                <p>• New inquiries will appear here for acceptance</p>
                <p>• Once accepted, conversations move to "Assigned Conversations"</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="text-sm text-orange-600 font-medium">Pending</p>
                    <p className="text-2xl font-bold text-orange-800">{pendingCount}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm text-green-600 font-medium">Accepted</p>
                    <p className="text-2xl font-bold text-green-800">{acceptedCount}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Total</p>
                    <p className="text-2xl font-bold text-blue-800">{conversations.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Completion Rate</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {conversations.length > 0 ? Math.round((acceptedCount / conversations.length) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Date Filter Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-800 font-medium">Showing inquiries from August 18, 2025 onwards</p>
                  <p className="text-xs text-blue-600">Inquiries before this date are automatically accepted</p>
                </div>
              </div>
            </div>

            {/* Conversation List */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-medium text-gray-900">Your Assigned Inquiries</h3>
                <p className="text-sm text-gray-600">
                  Click to {pendingCount > 0 ? 'accept pending inquiries or ' : ''}view accepted conversations
                </p>
              </div>
              
              <div className="divide-y divide-gray-200">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`p-6 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                      conversation.expert_accepted ? 'bg-green-25 border-l-4 border-green-500' : 'bg-orange-25 border-l-4 border-orange-500'
                    }`}
                    onClick={() => handleConversationClick(conversation)}
                  >
                    <div className="flex items-start justify-between">
                      {/* Main Content */}
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-start gap-4">
                          {/* Status Indicator */}
                          <div className={`flex-shrink-0 w-3 h-3 rounded-full mt-2 ${
                            conversation.expert_accepted ? 'bg-green-500' : 'bg-orange-500'
                          }`} />
                          
                          {/* Customer Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-semibold text-gray-900 truncate">
                                {conversation.customer_name}
                              </h4>
                              {conversation.expert_accepted ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3" />
                                  {conversation.auto_accepted ? 'Auto-Accepted' : 'Accepted'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  <Clock className="w-3 h-3" />
                                  Pending
                                </span>
                              )}
                            </div>
                            
                            {/* Customer Details */}
                            <div className="flex items-center gap-6 mb-3 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                <span>{conversation.customer_email}</span>
                              </div>
                              {conversation.customer_phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4" />
                                  <span>{conversation.customer_phone}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>{formatDate(conversation.created_at)}</span>
                              </div>
                            </div>
                            
                            {/* Message Preview */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                              <p className="text-sm font-medium text-gray-700 mb-2">Initial Message:</p>
                              <p className="text-gray-800 leading-relaxed">
                                {conversation.message.length > 200 
                                  ? `${conversation.message.substring(0, 200)}...`
                                  : conversation.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Area */}
                      <div className="flex-shrink-0 flex flex-col items-end gap-3">
                        <div className="text-right">
                          <p className="text-xs text-gray-500 mb-1">
                            {formatRelativeTime(conversation.created_at)}
                          </p>
                          <p className="text-xs text-gray-400">
                            ID: {conversation.conversation_sid?.slice(-6) || 'N/A'}
                          </p>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConversationClick(conversation);
                          }}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                            conversation.expert_accepted
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                              : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                          }`}
                        >
                          {conversation.expert_accepted ? (
                            <>
                              <Eye className="w-4 h-4" />
                              Open Chat
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Accept
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Acceptance Modal */}
        {selectedConversation && (
          <ConversationAcceptanceModal
            conversation={selectedConversation}
            onClose={() => setSelectedConversation(null)}
            onAccept={handleAcceptConversation}
            isAccepting={isAccepting}
          />
        )}
      </div>
    </div>
  );
}

// Helper function to format dates
function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(dateString));
}

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}