import React, { useState } from 'react';
import { X, MessageSquare, User, Mail, Phone, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface ConversationDetails {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  message: string;
  conversation_sid: string;
  status: string;
  created_at: string;
  expert_accepted: boolean;
  expert_accepted_at?: string;
}

interface ConversationAcceptanceModalProps {
  conversation: ConversationDetails;
  onClose: () => void;
  onAccept: (conversationId: string) => Promise<void>;
  isAccepting?: boolean;
}

export function ConversationAcceptanceModal({
  conversation,
  onClose,
  onAccept,
  isAccepting = false,
}: ConversationAcceptanceModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      await onAccept(conversation.id);
      onClose();
    } catch (error) {
      console.error('Failed to accept conversation:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(dateString));
  };

  const getStatusDisplay = () => {
    if (conversation.expert_accepted) {
      return {
        icon: CheckCircle,
        text: 'Accepted',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-200'
      };
    } else {
      return {
        icon: Clock,
        text: 'Pending Acceptance',
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        borderColor: 'border-orange-200'
      };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Conversation Details
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Status Badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${statusDisplay.bgColor} ${statusDisplay.borderColor}`}>
            <StatusIcon className={`w-4 h-4 ${statusDisplay.color}`} />
            <span className={`text-sm font-medium ${statusDisplay.color}`}>
              {statusDisplay.text}
            </span>
          </div>

          {/* Customer Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Customer Information
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-medium text-gray-900">{conversation.customer_name}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium text-gray-900">{conversation.customer_email}</p>
                </div>
              </div>
              
              {conversation.customer_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium text-gray-900">{conversation.customer_phone}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">Inquiry Date</p>
                  <p className="font-medium text-gray-900">{formatDate(conversation.created_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Initial Message */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Initial Message
            </h3>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-gray-800 leading-relaxed">{conversation.message}</p>
            </div>
          </div>

          {/* Conversation Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Conversation Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Conversation ID:</span>
                <span className="font-mono text-gray-800">{conversation.conversation_sid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Status:</span>
                <span className={`font-medium ${
                  conversation.status === 'assigned' ? 'text-orange-600' :
                  conversation.status === 'in_progress' ? 'text-blue-600' :
                  conversation.status === 'resolved' ? 'text-green-600' :
                  'text-gray-600'
                }`}>
                  {conversation.status.charAt(0).toUpperCase() + conversation.status.slice(1).replace('_', ' ')}
                </span>
              </div>
              {conversation.expert_accepted_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Accepted At:</span>
                  <span className="text-gray-800">{formatDate(conversation.expert_accepted_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Warning for pending conversations */}
          {!conversation.expert_accepted && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800 mb-1">Conversation Access</h4>
                  <p className="text-sm text-amber-700">
                    You currently cannot access this conversation's messages until you accept it. 
                    Once accepted, you'll be able to see all previous messages and participate in the conversation.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            Close
          </button>
          
          {!conversation.expert_accepted && (
            <button
              onClick={handleAccept}
              disabled={isProcessing || isAccepting}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isProcessing || isAccepting ? (
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
          )}
          
          {conversation.expert_accepted && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg">
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium">Already Accepted</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
