/*
  # Auto-accept conversations before August 18, 2025

  1. Updates
    - Set all inquiries created before Aug 18, 2025 to 'in_progress' status
    - This automatically marks them as "accepted" by experts
    - Only affects inquiries currently in 'assigned' or 'new' status

  2. Security
    - Safe operation - only changes status, no data loss
    - Filters by date to avoid affecting new inquiries
*/

-- Auto-accept all conversations created before August 18, 2025 UTC
UPDATE inquiries 
SET 
  status = 'in_progress',
  updated_at = CURRENT_TIMESTAMP
WHERE 
  created_at < '2025-08-18 00:00:00+00'::timestamptz
  AND status IN ('new', 'assigned');

-- Log the changes
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Auto-accepted % conversations created before August 18, 2025', updated_count;
END $$;