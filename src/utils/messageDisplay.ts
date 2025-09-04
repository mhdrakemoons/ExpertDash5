import type { TwilioMessage, User } from '../types';

export interface MessageDisplayInfo {
  displayName: string;
  type: 'bot' | 'admin' | 'expert' | 'traveler' | 'current_user' | 'external';
  isCurrentUser: boolean;
  color: string;
  icon: 'bot' | 'admin' | 'expert' | 'traveler' | 'user';
}

/**
 * Parse 'from' attribute from message attributes
 */
function parseFromAttribute(attributes?: Record<string, any>): string | null {
  if (!attributes) return null;
  
  try {
    // Handle both direct object and JSON string
    if (typeof attributes === 'string') {
      const parsed = JSON.parse(attributes);
      return parsed.from || null;
    }
    
    return attributes.from || null;
  } catch (error) {
    console.warn('Failed to parse message attributes:', error);
    return null;
  }
}

/**
 * Get display information for a message based on the 'from' attribute and fallback logic
 */
export function getMessageDisplayInfo(message: TwilioMessage, currentUser: User | null): MessageDisplayInfo {
  const fromAttribute = parseFromAttribute(message.attributes);
  
  // Check if this is the current user's message
  const isCurrentUser = message.author === currentUser?.email || 
                       message.author === currentUser?.name;
  
  // Use 'from' attribute if available
  if (fromAttribute) {
    let type: MessageDisplayInfo['type'] = 'external';
    let icon: MessageDisplayInfo['icon'] = 'user';
    let color = 'gray';
    
    if (fromAttribute === 'Bot') {
      type = 'bot';
      icon = 'bot';
      color = 'green';
    } else if (fromAttribute === 'Baboo Team') {
      type = 'admin';
      icon = 'admin';
      color = 'blue';
    } else if (fromAttribute.includes('- Local Expert')) {
      type = 'expert';
      icon = 'expert';
      color = 'purple';
    } else if (fromAttribute.includes('- Traveler')) {
      type = 'traveler';
      icon = 'traveler';
      color = 'orange';
    }
    
    // Override type if it's the current user
    if (isCurrentUser) {
      type = 'current_user';
      color = 'blue';
    }
    
    return {
      displayName: fromAttribute,
      type,
      isCurrentUser,
      color,
      icon
    };
  }
  
  // NEW: Default to "Bot" for messages without "from" attribute from bot/system authors
  const lowerAuthor = message.author?.toLowerCase() || '';
  const isBotAuthor = lowerAuthor.includes('bot') || 
                     lowerAuthor.includes('system') || 
                     lowerAuthor.includes('support_bot_') ||
                     message.author === 'system' ||
                     lowerAuthor.includes('make') ||
                     lowerAuthor.includes('webhook');
  
  if (isBotAuthor && !isCurrentUser) {
    return {
      displayName: 'Bot',
      type: 'bot',
      isCurrentUser: false,
      color: 'green',
      icon: 'bot'
    };
  }
  
  // Handle current user messages with enhanced display
  if (isCurrentUser) {
    let displayName = 'You';
    let type: MessageDisplayInfo['type'] = 'current_user';
    
    // Enhanced display name based on user role with name + email
    if (currentUser) {
      switch (currentUser.role) {
        case 'admin':
          displayName = `You (${currentUser.name} - Baboo Team)`;
          break;
        case 'expert':
          displayName = `You (${currentUser.name} - ${currentUser.email})`;
          break;
        case 'bot':
          displayName = 'You (Bot)';
          type = 'bot';
          break;
        default:
          displayName = 'You';
          break;
      }
    }
    
    return {
      displayName,
      type,
      isCurrentUser: true,
      color: 'blue',
      icon: currentUser?.role === 'bot' ? 'bot' : 
            currentUser?.role === 'admin' ? 'admin' :
            currentUser?.role === 'expert' ? 'expert' : 'user'
    };
  }
  
  // Enhanced fallback logic for non-current users
  let displayName = message.author;
  let type: MessageDisplayInfo['type'] = 'external';
  let icon: MessageDisplayInfo['icon'] = 'user';
  let color = 'gray';
  
  // Check for known admin email
  if (message.author === 'tekami.albert@gmail.com') {
    displayName = 'Albert Tekami - Baboo Team';
    type = 'admin';
    icon = 'admin';
    color = 'blue';
  }
  // Check for admin indicators in author
  else if (lowerAuthor.includes('admin')) {
    displayName = message.author.includes('@') ? 
      `${message.author.split('@')[0]} - Baboo Team` : 'Baboo Team';
    type = 'admin';
    icon = 'admin';
    color = 'blue';
  }
  // Check for expert indicators (email addresses that aren't admin)
  else if (message.author?.includes('@') && !lowerAuthor.includes('admin') && !isBotAuthor) {
    const emailName = message.author.split('@')[0];
    const name = emailName.replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    displayName = `${name} - ${message.author}`;
    type = 'expert';
    icon = 'expert';
    color = 'purple';
  }
  
  return {
    displayName,
    type,
    isCurrentUser: false,
    color,
    icon
  };
}

/**
 * Get appropriate styling classes for a message based on its display info
 */
export function getMessageStyling(displayInfo: MessageDisplayInfo): {
  containerClass: string;
  nameClass: string;
  iconColor: string;
} {
  const { type, isCurrentUser, color } = displayInfo;
  
  let containerClass = '';
  let nameClass = '';
  let iconColor = '';
  
  if (isCurrentUser) {
    containerClass = 'bg-blue-600 text-white';
    nameClass = 'text-blue-100';
    iconColor = 'text-blue-200';
  } else {
    switch (type) {
      case 'bot':
        containerClass = 'bg-green-100 text-green-900 border border-green-200';
        nameClass = 'text-green-700';
        iconColor = 'text-green-600';
        break;
      case 'admin':
        containerClass = 'bg-blue-100 text-blue-900 border border-blue-200';
        nameClass = 'text-blue-700';
        iconColor = 'text-blue-600';
        break;
      case 'expert':
        containerClass = 'bg-purple-100 text-purple-900 border border-purple-200';
        nameClass = 'text-purple-700';
        iconColor = 'text-purple-600';
        break;
      case 'traveler':
        containerClass = 'bg-orange-100 text-orange-900 border border-orange-200';
        nameClass = 'text-orange-700';
        iconColor = 'text-orange-600';
        break;
      default:
        containerClass = 'bg-gray-100 text-gray-900 border border-gray-200';
        nameClass = 'text-gray-700';
        iconColor = 'text-gray-600';
        break;
    }
  }
  
  return {
    containerClass,
    nameClass,
    iconColor
  };
}

/**
 * Check if a string (email, name, or identity) indicates a bot user
 */
export function isBotMessage(identity: string): boolean {
  if (!identity) return false;
  
  const lowerIdentity = identity.toLowerCase();
  const botKeywords = [
    'bot',
    'system', 
    'auto',
    'make',
    'webhook',
    'support_bot_',
    'automated',
    'service',
    'api'
  ];
  
  return botKeywords.some(keyword => lowerIdentity.includes(keyword));
}

/**
 * Get the appropriate icon component name for a message type
 */
export function getMessageIcon(icon: MessageDisplayInfo['icon']): string {
  switch (icon) {
    case 'bot':
      return 'Bot';
    case 'admin':
      return 'Shield';
    case 'expert':
      return 'UserCheck';
    case 'traveler':
      return 'MapPin';
    default:
      return 'User';
  }
}
