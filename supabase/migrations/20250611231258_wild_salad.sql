/*
  # Add customer phone column to inquiries table

  1. Changes
    - Add `customer_phone` column to `inquiries` table
    - Update existing records to have NULL values
    - Add index for phone number lookups

  2. Security
    - Maintain existing RLS policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inquiries' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE inquiries ADD COLUMN customer_phone text;
    
    -- Add index for phone number lookups
    CREATE INDEX IF NOT EXISTS inquiries_customer_phone_idx ON inquiries(customer_phone);
    
    RAISE NOTICE 'Added customer_phone column to inquiries table';
  ELSE
    RAISE NOTICE 'customer_phone column already exists in inquiries table';
  END IF;
END $$;