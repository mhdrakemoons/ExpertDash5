const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const googleSheetsService = require('../services/googleSheetsService');

const router = express.Router();

// Get data from a specific sheet
router.get('/data/:sheetName', authenticateToken, async (req, res) => {
  try {
    const { sheetName } = req.params;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      return res.status(500).json({ 
        message: 'Google Sheet ID not configured. Please set GOOGLE_SHEET_ID in environment variables.',
        error: 'MISSING_SHEET_ID'
      });
    }

    if (!googleSheetsService.isConfigured()) {
      return res.status(500).json({ 
        message: 'Google Sheets service not configured. Please set GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY in environment variables.',
        error: 'SERVICE_NOT_CONFIGURED'
      });
    }

    console.log(`📊 Request to fetch data from sheet "${sheetName}" by user:`, req.user.email);

    const data = await googleSheetsService.getSheetData(spreadsheetId, sheetName);

    res.json({
      success: true,
      message: `Data retrieved from sheet "${sheetName}"`,
      data: data,
      meta: {
        sheetName,
        spreadsheetId,
        rowCount: data.length,
        hasHeaders: data.length > 0,
        retrievedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`❌ Error fetching sheet data for "${req.params.sheetName}":`, error);
    
    res.status(500).json({ 
      success: false,
      message: error.message,
      error: 'SHEET_ACCESS_ERROR',
      sheetName: req.params.sheetName
    });
  }
});

// Get list of all sheets in the spreadsheet
router.get('/sheets', authenticateToken, async (req, res) => {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      return res.status(500).json({ 
        message: 'Google Sheet ID not configured. Please set GOOGLE_SHEET_ID in environment variables.',
        error: 'MISSING_SHEET_ID'
      });
    }

    if (!googleSheetsService.isConfigured()) {
      return res.status(500).json({ 
        message: 'Google Sheets service not configured.',
        error: 'SERVICE_NOT_CONFIGURED'
      });
    }

    console.log(`📋 Request to list all sheets by user:`, req.user.email);

    const sheetNames = await googleSheetsService.getSheetNames(spreadsheetId);

    res.json({
      success: true,
      message: 'Sheet names retrieved successfully',
      data: sheetNames,
      meta: {
        spreadsheetId,
        sheetCount: sheetNames.length,
        retrievedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error fetching sheet names:', error);
    
    res.status(500).json({ 
      success: false,
      message: error.message,
      error: 'SHEETS_LIST_ERROR'
    });
  }
});

// Health check for Google Sheets service
router.get('/status', authenticateToken, (req, res) => {
  const status = googleSheetsService.getStatus();
  
  res.json({
    success: true,
    message: 'Google Sheets service status',
    data: {
      ...status,
      spreadsheetConfigured: !!process.env.GOOGLE_SHEET_ID,
      spreadsheetId: process.env.GOOGLE_SHEET_ID ? `${process.env.GOOGLE_SHEET_ID.substring(0, 10)}...` : null,
    }
  });
});

module.exports = router;