const twilio = require('twilio');
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
const conversationsServiceSid = process.env.TWILIO_CONVERSATIONS_SERVICE_SID;

if (!accountSid || !authToken) {
  console.warn('Twilio credentials not found. Twilio functionality will be disabled.');
}

if (!conversationsServiceSid) {
  console.warn('Twilio Conversations Service SID not found. Conversation creation will be disabled.');
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

module.exports = {
  client,
  phoneNumber,
  conversationsServiceSid,
  isConfigured: !!(accountSid && authToken),
  conversationsConfigured: !!(accountSid && authToken && conversationsServiceSid)
};