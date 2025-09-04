const { google } = require('googleapis');
require('dotenv').config();

class GoogleSheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      console.log('🔄 Initializing Google Sheets service...');
      
      // Check for required environment variables
      const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
      
      if (!clientEmail || !privateKey) {
        throw new Error('Google Sheets credentials not configured. Please set GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY in your environment variables.');
      }

      // Create JWT auth
      this.auth = new google.auth.JWT(
        clientEmail,
        null,
        privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
        ['https://www.googleapis.com/auth/spreadsheets.readonly']
      );

      // Initialize sheets API
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      
      // Test the connection
      await this.auth.authorize();
      console.log('✅ Google Sheets service initialized successfully');
      this.initialized = true;
      
    } catch (error) {
      console.error('❌ Failed to initialize Google Sheets service:', error);
      throw new Error(`Google Sheets initialization failed: ${error.message}`);
    }
  }

  async getSheetData(spreadsheetId, sheetName) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log(`📊 Fetching data from sheet "${sheetName}" in spreadsheet ${spreadsheetId}...`);
      
      // Construct the range - this will get all data from the sheet
      const range = `${sheetName}!A:Z`; // Covers columns A through Z
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range,
      });

      const rows = response.data.values || [];
      console.log(`✅ Retrieved ${rows.length} rows from sheet "${sheetName}"`);
      
      if (rows.length === 0) {
        console.log(`ℹ️ Sheet "${sheetName}" is empty`);
        return [];
      }

      // Log first few rows for debugging (without sensitive data)
      console.log(`📋 First row (headers): ${JSON.stringify(rows[0])}`);
      if (rows.length > 1) {
        console.log(`📋 Data rows available: ${rows.length - 1}`);
      }

      return rows;
      
    } catch (error) {
      console.error(`❌ Failed to fetch data from sheet "${sheetName}":`, error);
      
      // Provide more specific error messages
      if (error.code === 400) {
        throw new Error(`Sheet "${sheetName}" not found in the spreadsheet. Please check the sheet name.`);
      } else if (error.code === 403) {
        throw new Error('Access denied. Please ensure the service account has access to the spreadsheet.');
      } else if (error.code === 404) {
        throw new Error('Spreadsheet not found. Please check the spreadsheet ID.');
      } else {
        throw new Error(`Failed to access Google Sheet: ${error.message}`);
      }
    }
  }

  // Get list of all sheets in the spreadsheet
  async getSheetNames(spreadsheetId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log(`📋 Getting sheet names for spreadsheet ${spreadsheetId}...`);
      
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
      });

      const sheets = response.data.sheets || [];
      const sheetNames = sheets.map(sheet => sheet.properties.title);
      
      console.log(`✅ Found ${sheetNames.length} sheets:`, sheetNames);
      return sheetNames;
      
    } catch (error) {
      console.error('❌ Failed to get sheet names:', error);
      throw new Error(`Failed to get sheet names: ${error.message}`);
    }
  }

  // Check if the service is properly configured
  isConfigured() {
    return !!(process.env.GOOGLE_SHEETS_CLIENT_EMAIL && process.env.GOOGLE_SHEETS_PRIVATE_KEY);
  }

  // Get configuration status for debugging
  getStatus() {
    return {
      configured: this.isConfigured(),
      initialized: this.initialized,
      hasAuth: !!this.auth,
      hasSheets: !!this.sheets,
    };
  }
}

module.exports = new GoogleSheetsService();