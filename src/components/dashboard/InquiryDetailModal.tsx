import React from 'react';
import { X, User, MapPin, Calendar, Phone, Mail, Users, Clock, Star, MessageSquare, ExternalLink, FileText, Shield } from 'lucide-react';

interface InquiryRow {
  [key: string]: string;
}

interface InquiryDetailModalProps {
  inquiry: InquiryRow | null;
  onClose: () => void;
}

interface InquiryField {
  key: string;
  label: string;
  value: string;
  icon?: React.ComponentType<any>;
  isLink?: boolean;
  linkType?: 'email' | 'phone' | 'url';
}

export function InquiryDetailModal({ inquiry, onClose }: InquiryDetailModalProps) {
  if (!inquiry) return null;

  // Transform raw field names to user-friendly labels with icons
  const transformFieldToDetail = (key: string, value: string): InquiryField => {
    const fieldMappings: Record<string, { label: string; icon?: React.ComponentType<any>; isLink?: boolean; linkType?: 'email' | 'phone' | 'url' }> = {
      'Full Name': { label: 'Full Name', icon: User },
      'First Name': { label: 'First Name', icon: User },
      'Email Address': { label: 'Email Address', icon: Mail, isLink: true, linkType: 'email' },
      'Phone Number': { label: 'Phone Number', icon: Phone, isLink: true, linkType: 'phone' },
      'Destination': { label: 'Destination', icon: MapPin },
      'When they want to go': { label: 'Travel Date', icon: Calendar },
      'Days Staying': { label: 'Duration', icon: Clock },
      'Group Amount': { label: 'Group Size', icon: Users },
      'Group Ages': { label: 'Group Ages', icon: Users },
      'User Stay Pref': { label: 'Accommodation Preference', icon: Star },
      'User Budget': { label: 'Budget', icon: Star },
      'User Preferences / Vibe': { label: 'Travel Preferences', icon: Star },
      'Extra Note for Local Expert': { label: 'Expert Notes', icon: MessageSquare },
      'Local Expert': { label: 'Assigned Expert', icon: User },
      'Local Expert - Phone Number': { label: 'Expert Phone', icon: Phone, isLink: true, linkType: 'phone' },
      'Local Expert - Email Address': { label: 'Expert Email', icon: Mail, isLink: true, linkType: 'email' },
      'Local Expert Preferred Contact Method': { label: 'Expert Contact Method', icon: MessageSquare },
      'Type (finished / in-flow)': { label: 'Status', icon: FileText },
      'Stage': { label: 'Stage', icon: FileText },
      'Last Response': { label: 'Last Response', icon: Clock },
      'Last Local Expert Response': { label: 'Last Expert Response', icon: Clock },
      'Whole Conversation': { label: 'Conversation History', icon: MessageSquare },
      'Proposal Code / URL': { label: 'Proposal', icon: ExternalLink, isLink: true, linkType: 'url' },
      'Contact Method': { label: 'Contact Method', icon: MessageSquare },
      'ConversationSid': { label: 'Twilio Conversation ID', icon: MessageSquare },
      'Trip Finished Date': { label: 'Trip Completed', icon: Calendar },
      'Feedback Received': { label: 'Feedback Status', icon: Star },
    };

    const mapping = fieldMappings[key] || { label: key };
    
    return {
      key,
      label: mapping.label,
      value: value || 'Not specified',
      icon: mapping.icon,
      isLink: mapping.isLink,
      linkType: mapping.linkType
    };
  };

  // Get all non-empty fields
  const allFields = Object.entries(inquiry)
    .filter(([key, value]) => value && value.trim() !== '')
    .map(([key, value]) => transformFieldToDetail(key, value));

  // Split fields into two columns
  const leftColumnFields = allFields.filter((_, index) => index % 2 === 0);
  const rightColumnFields = allFields.filter((_, index) => index % 2 === 1);

  const renderField = (field: InquiryField) => {
    const Icon = field.icon;
    
    const renderValue = () => {
      if (field.isLink && field.linkType) {
        switch (field.linkType) {
          case 'email':
            return (
              <a 
                href={`mailto:${field.value}`}
                className="text-blue-600 hover:text-blue-700 underline break-all"
              >
                {field.value}
              </a>
            );
          case 'phone':
            return (
              <a 
                href={`tel:${field.value}`}
                className="text-blue-600 hover:text-blue-700 underline"
              >
                {field.value}
              </a>
            );
          case 'url':
            if (field.value.startsWith('http')) {
              return (
                <a 
                  href={field.value} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 underline flex items-center gap-1 break-all"
                >
                  View Proposal
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              );
            }
            return <span className="whitespace-pre-wrap break-words">{field.value}</span>;
          default:
            return <span className="whitespace-pre-wrap break-words">{field.value}</span>;
        }
      }
      return <span className="whitespace-pre-wrap break-words">{field.value}</span>;
    };

    return (
      <div key={field.key} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-3">
          {Icon && <Icon className="w-4 h-4 text-blue-600" />}
          <dt className="text-sm font-semibold text-gray-800 bg-gray-50 px-3 py-1 rounded-full">
            {field.label}
          </dt>
        </div>
        <dd className="text-sm text-gray-900 leading-relaxed bg-gray-50 p-3 rounded-lg border-l-4 border-blue-200">
          {renderValue()}
        </dd>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {inquiry['Full Name'] || inquiry['First Name'] || 'Inquiry Details'}
                </h2>
                <div className="flex items-center gap-4 mt-1">
                  {inquiry['Destination'] && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>Traveling to {inquiry['Destination']}</span>
                    </div>
                  )}
                  {inquiry['Type (finished / in-flow)'] && (
                    <span className={`px-3 py-1 text-sm rounded-full font-medium ${
                      inquiry['Type (finished / in-flow)'].toLowerCase().includes('finished') 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {inquiry['Type (finished / in-flow)']}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] bg-gray-50">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 pb-3 border-b-2 border-blue-200 bg-white px-4 py-2 rounded-lg shadow-sm">
                Primary Information
              </h3>
              {leftColumnFields.map(field => renderField(field))}
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 pb-3 border-b-2 border-blue-200 bg-white px-4 py-2 rounded-lg shadow-sm">
                Additional Details
              </h3>
              {rightColumnFields.map(field => renderField(field))}
            </div>
          </div>

          {/* Empty state if no fields */}
          {allFields.length === 0 && (
            <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No details available for this inquiry</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}