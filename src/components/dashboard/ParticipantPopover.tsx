import React from 'react';
import { X, User, Phone, Bot, Shield, Users as UsersIcon } from 'lucide-react';
import type { TwilioParticipant } from '../../types';

interface ParticipantPopoverProps {
  participants: TwilioParticipant[];
  onClose: () => void;
  position?: { x: number; y: number };
}

export function ParticipantPopover({ participants = [], onClose, position }: ParticipantPopoverProps) {
  const getParticipantIcon = (participant: TwilioParticipant) => {
    // Specific admin user
    if (participant.identity === 'tekami.albert@gmail.com') {
      return Shield;
    }
    if (participant.identity?.includes('support_bot_') || participant.displayName === 'Support Bot') {
      return Bot;
    }
    if (participant.isCustomer) {
      return Phone;
    }
    if (participant.identity?.includes('@') && participant.identity?.includes('admin')) {
      return Shield;
    }
    return User;
    
    return User; // Default fallback
  };

  const getParticipantRole = (participant: TwilioParticipant) => {
    // Specific admin user
    if (participant.identity === 'tekami.albert@gmail.com') {
      return 'Admin';
    }
    if (participant.identity?.includes('support_bot_') || participant.displayName === 'Support Bot') {
      return 'Bot';
    }
    if (participant.isCustomer) {
      return 'Customer (SMS)';
    }
    if (participant.identity?.includes('@') && participant.identity?.includes('admin')) {
      return 'Admin';
    }
    return 'Expert';
    
    return 'Unknown'; // Default fallback
  };

  const getParticipantColor = (participant: TwilioParticipant) => {
    // Specific admin user
    if (participant.identity === 'tekami.albert@gmail.com') {
      return 'text-blue-600';
    }
    if (participant.identity?.includes('support_bot_') || participant.displayName === 'Support Bot') {
      return 'text-green-600';
    }
    if (participant.isCustomer) {
      return 'text-orange-600';
    }
    if (participant.identity?.includes('@') && participant.identity?.includes('admin')) {
      return 'text-blue-600';
    }
    return 'text-gray-600';
    
    return 'text-gray-500'; // Default fallback
  };

  // Enhanced positioning logic to keep popover within viewport
  const getPopoverStyle = () => {
    if (!position) return {};
    
    const popoverWidth = 320;
    const popoverHeight = Math.min(300, participants.length * 60 + 120); // Dynamic height based on participants
    const margin = 10;
    
    let left = position.x;
    let top = position.y + margin;
    
    // Adjust horizontal position if popover would go off right edge
    if (left + popoverWidth > window.innerWidth - margin) {
      left = window.innerWidth - popoverWidth - margin;
    }
    
    // Adjust horizontal position if popover would go off left edge
    if (left < margin) {
      left = margin;
    }
    
    // Adjust vertical position if popover would go off bottom edge
    if (top + popoverHeight > window.innerHeight - margin) {
      // Position above the trigger element
      top = position.y - popoverHeight - margin;
    }
    
    // If still off screen at top, position at top of viewport
    if (top < margin) {
      top = margin;
    }
    
    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 1000,
      width: `${popoverWidth}px`,
      maxHeight: `${Math.min(popoverHeight, window.innerHeight - 2 * margin)}px`,
    };
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      {/* Popover */}
      <div 
        className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 overflow-hidden"
        style={getPopoverStyle()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            <div className="flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-blue-600" />
              Participants ({participants.length})
            </div>
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100% - 60px)' }}>
          {participants.map((participant) => {
            const Icon = getParticipantIcon(participant);
            const role = getParticipantRole(participant);
            const color = getParticipantColor(participant);
            
            // Ensure we have valid data
            const displayName = participant.displayName || participant.identity || 'Unknown';
            const identity = participant.identity || 'No identity';
            
            return (
              <div 
                key={participant.sid} 
                className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className={`w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {displayName}
                    </p>
                    <span className={`px-2 py-0.5 text-xs rounded-full bg-gray-100 ${color}`}>
                      {role}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {identity}
                  </p>
                  {participant.type && (
                    <p className="text-xs text-gray-400">
                      Type: {participant.type}
                    </p>
                  )}
                  {participant.isCustomer !== undefined && (
                    <p className="text-xs text-gray-400">
                      {participant.isCustomer ? 'Customer' : 'Staff'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {participants.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm">Loading participants...</p>
            <p className="text-xs text-gray-400 mt-1">Participants load when conversation is selected</p>
          </div>
        )}
      </div>
    </>
  );
}