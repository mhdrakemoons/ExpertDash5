import React from 'react';
import { CheckCircle, X, MessageSquare, User, Mail, Phone, Calendar, AlertTriangle } from 'lucide-react';

interface ConversationAcceptancePopupProps {
  conversationSid: string;
  onAccept: () => void;
  onDecline: () => void;
  isAccepting: boolean;
  conversationData?: {
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    message?: string;
    created_at?: string;
  };
}

export function ConversationAcceptancePopup({
  conversationSid,
  onAccept,
  onDecline,
  isAccepting,
  conversationData,
}: ConversationAcceptancePopupProps) {
  
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(dateString));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Accept Conversation</h2>
                <p className="text-sm text-gray-600">Review this conversation before accepting</p>
              </div>
            </div>
            <button
              onClick={onDecline}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white transition-colors"
              disabled={isAccepting}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {conversationData ? (
            <div className="space-y-6">
              {/* Customer Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-600" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium text-gray-900">{conversationData.customer_name || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{conversationData.customer_email || 'Unknown'}</p>
                    </div>
                  </div>
                  {conversationData.customer_phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-medium text-gray-900">{conversationData.customer_phone}</p>
                      </div>
                    </div>
                  )}
                  {conversationData.created_at && (
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Created</p>
                        <p className="font-medium text-gray-900">{formatDate(conversationData.created_at)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Initial Message */}
              {conversationData.message && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                    Initial Message
                  </h3>
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <p className="text-gray-800 leading-relaxed">{conversationData.message}</p>
                  </div>
                </div>
              )}

              {/* Conversation ID */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Conversation Details</h3>
                <p className="text-xs text-gray-500 font-mono">
                  ID: {conversationSid}
                </p>
              </div>

              {/* Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-amber-800">Important</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      By accepting this conversation, you commit to helping this customer. 
                      You'll be able to send and receive messages in real-time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading conversation details...</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-end gap-4">
            <button
              onClick={onDecline}
              disabled={isAccepting}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onAccept}
              disabled={isAccepting || !conversationData}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isAccepting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Accept Conversation
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
