/**
 * Utility functions for message handling and 'from' attribute generation
 */

/**
 * Generate the appropriate 'from' attribute based on user role and context
 * @param {Object} user - User object with name, email, role
 * @param {string} messageType - Type of message: 'bot', 'system', 'user', 'external'
 * @param {Object} context - Additional context (travelerName, expertName, etc.)
 * @returns {string} The 'from' attribute value
 */
function generateFromAttribute(user, messageType = 'user', context = {}) {
  // Handle bot/system messages
  if (messageType === 'bot' || messageType === 'system') {
    return 'Bot';
  }

  // Handle external messages with specific context
  if (messageType === 'external') {
    if (context.travelerName) {
      return `${context.travelerName} - Traveler`;
    }
    if (context.expertName) {
      return `${context.expertName} - Local Expert`;
    }
    return 'Bot'; // Fallback for external messages without context
  }

  // Handle user messages based on role
  if (user) {
    switch (user.role) {
      case 'admin':
        return 'Baboo Team';
      
      case 'expert':
        return `${user.name} - Local Expert`;
      
      case 'bot':
        return 'Bot';
      
      default:
        // For any other role, use the name if available
        return user.name ? `${user.name} - Traveler` : 'Unknown User';
    }
  }

  // Fallback
  return 'Unknown User';
}

/**
 * Determine message type based on author and context
 * @param {string} author - Message author
 * @param {Object} context - Additional context
 * @returns {string} Message type
 */
function determineMessageType(author, context = {}) {
  if (!author) return 'system';
  
  const lowerAuthor = author.toLowerCase();
  
  // Check for bot indicators
  if (lowerAuthor.includes('bot') || 
      lowerAuthor.includes('system') || 
      lowerAuthor.includes('support_bot_') ||
      author === 'system') {
    return 'bot';
  }
  
  // Check for Make.com or external system indicators
  if (lowerAuthor.includes('make') || 
      lowerAuthor.includes('webhook') || 
      lowerAuthor.includes('external')) {
    return 'external';
  }
  
  return 'user';
}

/**
 * Parse 'from' attribute from message attributes
 * @param {string|Object} attributes - Message attributes (JSON string or object)
 * @returns {string|null} The 'from' value or null if not found
 */
function parseFromAttribute(attributes) {
  try {
    let attrs = attributes;
    
    if (typeof attributes === 'string') {
      attrs = JSON.parse(attributes);
    }
    
    return attrs?.from || null;
  } catch (error) {
    console.warn('Failed to parse message attributes:', error);
    return null;
  }
}

/**
 * Get display name for message sender based on 'from' attribute and fallback logic
 * @param {Object} message - Message object with author, attributes
 * @param {Object} currentUser - Current user for comparison
 * @returns {Object} Display information { displayName, type, isCurrentUser }
 */
function getMessageDisplayInfo(message, currentUser) {
  const fromAttribute = parseFromAttribute(message.attributes);
  
  // Use 'from' attribute if available
  if (fromAttribute) {
    const isCurrentUser = message.author === currentUser?.email || 
                         message.author === currentUser?.name;
    
    let type = 'external';
    if (fromAttribute === 'Bot') type = 'bot';
    else if (fromAttribute === 'Baboo Team') type = 'admin';
    else if (fromAttribute.includes('- Local Expert')) type = 'expert';
    else if (fromAttribute.includes('- Traveler')) type = 'traveler';
    
    return {
      displayName: fromAttribute,
      type,
      isCurrentUser
    };
  }
  
  // Fallback to existing author-based logic
  const isCurrentUser = message.author === currentUser?.email || 
                       message.author === currentUser?.name;
  
  if (isCurrentUser) {
    const userFromAttr = generateFromAttribute(currentUser, 'user');
    return {
      displayName: userFromAttr,
      type: currentUser?.role || 'user',
      isCurrentUser: true
    };
  }
  
  // Determine type and display name for non-current users
  const messageType = determineMessageType(message.author);
  let displayName = message.author;
  
  if (messageType === 'bot') {
    displayName = 'Bot';
  } else if (message.author === 'tekami.albert@gmail.com') {
    displayName = 'Baboo Team';
  }
  
  return {
    displayName,
    type: messageType,
    isCurrentUser: false
  };
}

module.exports = {
  generateFromAttribute,
  determineMessageType,
  parseFromAttribute,
  getMessageDisplayInfo
};
