/*
  # Create inquiries table for customer inquiries

  1. New Tables
    - `inquiries`
      - `id` (uuid, primary key)
      - `customer_name` (text)
      - `customer_email` (text)
      - `message` (text)
      - `conversation_sid` (text, unique)
      - `assigned_expert_id` (uuid, foreign key to users)
      - `status` (text, enum-like values)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `inquiries` table
    - Add policy for experts to read inquiries assigned to them
    - Add policy for service role to manage all inquiries
*/

CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  message text NOT NULL,
  conversation_sid text UNIQUE,
  assigned_expert_id uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'in_progress', 'resolved')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Experts can read inquiries assigned to them
CREATE POLICY "Experts can read assigned inquiries"
  ON inquiries
  FOR SELECT
  TO authenticated
  USING (assigned_expert_id::text = auth.uid()::text);

-- Service role (backend) can manage all inquiries
CREATE POLICY "Service role can manage inquiries"
  ON inquiries
  FOR ALL
  TO service_role
  USING (true);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS inquiries_conversation_sid_idx ON inquiries(conversation_sid);
CREATE INDEX IF NOT EXISTS inquiries_assigned_expert_id_idx ON inquiries(assigned_expert_id);
CREATE INDEX IF NOT EXISTS inquiries_status_idx ON inquiries(status);

-- Update timestamp trigger
CREATE TRIGGER update_inquiries_updated_at
  BEFORE UPDATE ON inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();