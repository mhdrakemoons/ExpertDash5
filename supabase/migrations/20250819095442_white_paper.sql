/*
  # Auto-accept conversations created before August 18, 2025

  1. Database Updates
    - Update all inquiries created before August 18, 2025 UTC to status 'in_progress'
    - This marks them as automatically accepted by experts
    
  2. Purpose
    - Ensure backward compatibility with existing conversations
    - Experts don't need to manually accept historical conversations
    - Only new conversations (Aug 18, 2025+) require explicit acceptance
*/

-- Auto-accept all inquiries created before August 18, 2025 UTC
UPDATE inquiries 
SET 
  status = 'in_progress',
  updated_at = CURRENT_TIMESTAMP
WHERE 
  created_at < '2025-08-18 00:00:00+00'::timestamptz 
  AND status = 'assigned'
  AND conversation_sid IS NOT NULL;

-- Log the number of updated records
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Auto-accepted % conversations created before August 18, 2025', updated_count;
END $$;