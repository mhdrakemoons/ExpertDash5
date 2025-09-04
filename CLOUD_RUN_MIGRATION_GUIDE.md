# Complete Migration Guide: Render → Google Cloud Run

## Overview
This guide will help you migrate your ExpertDash backend from Render to Google Cloud Run while keeping your Netlify frontend and staying within the free tier limits.

## Current Setup
- **Backend**: Node.js/Express on Render (`https://expertdash5.onrender.com`)
- **Frontend**: React/Vite on Netlify (`https://calm-heliotrope-f996ab.netlify.app`)
- **Database**: PostgreSQL (Supabase)
- **Services**: Twilio, Google Sheets API

---

## Phase 1: Prepare Your Backend for Cloud Run

### Step 1: Update Server Configuration

**File**: `backend/server.js`
Change the port configuration:
```javascript
const PORT = process.env.PORT || 8080;
```

### Step 2: Choose Your Build Method

#### Option A: Buildpacks (Recommended - Simpler)
No additional files needed! Google Cloud buildpacks will automatically:
- Detect your Node.js project from `package.json`
- Install dependencies with `npm install`
- Use your existing `npm start` script
- Handle all the containerization for you

#### Option B: Dockerfile (More Control)
If you prefer explicit control, create these files:

**Create**: `backend/Dockerfile`
```dockerfile
# Use the official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 8080

# Define environment variable for production
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"]
```

**Create**: `backend/.dockerignore`
```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.vscode
*.log
```

### Step 4: Commit Changes to GitHub
```bash
git add .
git commit -m "Add Cloud Run configuration files"
git push origin main
```

---

## Phase 2: Set Up Google Cloud Run

### Step 1: Enable Required APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable these APIs:
   - Cloud Run API
   - Cloud Build API
   - Container Registry API

### Step 2: Create Cloud Run Service

#### Option A: GitHub Integration (Recommended)
1. **Go to Cloud Run → Create Service**
2. **Select**: "Continuously deploy from a repository"
3. **Click**: "Set up with Cloud Build"
4. **Connect to GitHub**: Authorize and select your repository
5. **Configure Build**:
   - **Repository**: `YourUsername/ExpertDash5-main-aug18`
   - **Branch**: `main`
   - **Build Type**: ✅ **"Go, Node.js, Python, Java, .NET Core, Ruby or PHP via Google Cloud's buildpacks"** (Recommended)
   - **Build context directory**: `/backend`
   - **Entrypoint**: (leave empty - buildpack will use `npm start`)
   - **Function target**: (leave empty)

#### Option B: gcloud CLI (Alternative)
```bash
# Navigate to backend directory
cd backend

# Deploy to Cloud Run
gcloud run deploy expertdash-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 80 \
  --max-instances 10 \
  --min-instances 0
```

### Step 3: Configure Service Settings (Free Tier Optimized)

**Service Configuration**:
- **Service name**: `expertdash-backend`
- **Region**: `us-central1` (cheapest region)
- **Authentication**: ✅ Allow public access
- **Billing**: ✅ Request-based
- **Service scaling**: ✅ Auto scaling
  - **Minimum instances**: `0` (scales to zero = free)
  - **Maximum instances**: `10` (prevent runaway costs)
- **Ingress**: ✅ All
- **Encryption**: ✅ Google-managed encryption key

**Container Settings** (Click "Containers, Volumes, Networking, Security"):
- **Memory**: `512 MiB` (minimum for Node.js)
- **CPU**: `1` (minimum)
- **Request timeout**: `300 seconds`
- **Maximum concurrent requests per instance**: `80`

---

## Phase 3: Environment Variables Setup

### Required Environment Variables for Cloud Run:

After deployment, go to your service → "Edit & Deploy New Revision" → "Variables & Secrets":

```
DATABASE_URL=your_supabase_connection_string
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_API_KEY=your_twilio_api_key
TWILIO_API_SECRET=your_twilio_api_secret
TWILIO_CONVERSATIONS_SERVICE_SID=your_twilio_service_sid
JWT_SECRET=your_jwt_secret
GOOGLE_SHEETS_CLIENT_EMAIL=your_google_sheets_service_account_email
GOOGLE_SHEETS_PRIVATE_KEY=your_google_sheets_private_key
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
FRONTEND_URL=https://calm-heliotrope-f996ab.netlify.app
NODE_ENV=production
PORT=8080
```

**⚠️ Important**: Copy these values from your current Render environment variables.

---

## Phase 4: Update Frontend Configuration

### Step 1: Update Netlify Environment Variables

1. **Go to Netlify Dashboard** → Your Site → Site Settings → Environment Variables
2. **Add new variable**:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://your-cloud-run-service-url` (you'll get this after deployment)

### Step 2: Update CORS in Backend (if needed)

Your current CORS configuration should work, but verify the Cloud Run URL is allowed:

**File**: `backend/server.js` (lines 33-39)
```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000', 
  'https://calm-heliotrope-f996ab.netlify.app',
  'https://calm-heliotrope-f996ab.netlify.app/',
  'https://your-cloud-run-service-url', // Add this if needed
  process.env.FRONTEND_URL
].filter(Boolean);
```

---

## Phase 5: Update External Services

### Twilio Webhooks
Update your Twilio webhook URLs to point to Cloud Run:
- **Old**: `https://expertdash5.onrender.com/api/webhooks/...`
- **New**: `https://your-cloud-run-service-url/api/webhooks/...`

### Make.com Webhooks (if applicable)
Update any Make.com scenarios to use the new Cloud Run URL.

---

## Phase 6: Testing & Validation

### Step 1: Health Check
Visit: `https://your-cloud-run-service-url/api/health`

### Step 2: Test Frontend Connection
1. **Redeploy Netlify** (to pick up new environment variable)
2. **Test login/registration** on your frontend
3. **Check browser console** for any CORS errors

### Step 3: Monitor Cloud Run Logs
- Go to Cloud Run → Your Service → Logs
- Check for any startup errors or database connection issues

---

## Free Tier Limits & Optimization

### Cloud Run Free Tier Includes:
- ✅ **2 million requests per month**
- ✅ **360,000 GB-seconds of memory per month**
- ✅ **180,000 vCPU-seconds per month**
- ✅ **1 GB network egress per month**

### Optimization Settings to Stay Free:
1. **Minimum instances**: `0` (scales to zero when not used)
2. **Memory**: `512 MiB` (sufficient for Node.js)
3. **CPU**: `1` (minimum allocation)
4. **Concurrency**: `80` (handle more requests per instance)
5. **Request timeout**: `300s` (default)
6. **Region**: `us-central1` (cheapest)

### Cost Monitoring:
- Set up billing alerts in Google Cloud Console
- Monitor usage in Cloud Run metrics dashboard

---

## Phase 7: Cleanup & Finalization

### Step 1: Test Everything Works
- ✅ Frontend loads correctly
- ✅ Login/registration works
- ✅ Twilio conversations work
- ✅ Google Sheets integration works
- ✅ All API endpoints respond correctly

### Step 2: Update Documentation
- Update any internal documentation with new API URLs
- Update environment variable documentation

### Step 3: Decommission Render (Optional)
- **Wait 1-2 weeks** to ensure everything works perfectly
- **Cancel Render subscription** to save costs
- **Keep Render service running** for a few days as backup

---

## Troubleshooting

### Common Issues:

**1. "Service Unavailable" Error**
- Check Cloud Run logs for startup errors
- Verify all environment variables are set
- Ensure DATABASE_URL is correct

**2. CORS Errors**
- Add your Cloud Run URL to CORS allowedOrigins
- Check that FRONTEND_URL environment variable is set correctly

**3. Database Connection Issues**
- Verify Supabase project is active (not paused)
- Check DATABASE_URL format and credentials

**4. Build Failures**
- Ensure Dockerfile is in `/backend` directory
- Check that package.json has correct start script
- Verify all dependencies are listed in package.json

**5. Environment Variables Not Working**
- Check spelling and case sensitivity
- Ensure no trailing spaces in values
- For Google Sheets private key, ensure proper escaping of newlines

### Monitoring Commands:
```bash
# Check service status
gcloud run services describe expertdash-backend --region=us-central1

# View logs
gcloud logs read --service=expertdash-backend --limit=50

# Check revisions
gcloud run revisions list --service=expertdash-backend --region=us-central1
```

---

## Quick Reference

### Important URLs After Migration:
- **Cloud Run Service**: `https://expertdash-backend-xxxxxxxxx-uc.a.run.app`
- **Health Check**: `https://your-cloud-run-url/api/health`
- **Netlify Frontend**: `https://calm-heliotrope-f996ab.netlify.app`

### Environment Variables to Copy from Render:
- DATABASE_URL
- TWILIO_* (all Twilio variables)
- JWT_SECRET
- GOOGLE_SHEETS_* (all Google Sheets variables)

### Files Created:
- ✅ `backend/Dockerfile`
- ✅ `backend/.dockerignore`
- ✅ Updated `backend/server.js` (PORT = 8080)

---

## Cost Estimate (Free Tier)
With proper configuration:
- **Monthly cost**: $0 (within free tier limits)
- **Requests**: Up to 2 million/month free
- **Scaling**: Automatic scale-to-zero when not in use
- **Performance**: Better than Render's always-on free tier

---

## Support
If you encounter issues:
1. Check Cloud Run logs first
2. Verify all environment variables are set
3. Test each API endpoint individually
4. Compare with working Render configuration

**Note**: Keep your Render service running until you've fully tested Cloud Run for at least a week to ensure everything works perfectly.
