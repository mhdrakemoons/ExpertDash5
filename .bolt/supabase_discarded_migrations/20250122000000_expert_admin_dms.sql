-- Create expert_admin_dms table for DM conversations between experts and admins
CREATE TABLE IF NOT EXISTS expert_admin_dms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id UUID REFERENCES users(id) NOT NULL,
  admin_id UUID REFERENCES users(id) NOT NULL,
  conversation_sid TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_expert_admin_pair UNIQUE(expert_id, admin_id)
);

-- Add dm_conversation_sid column to inquiries table for admin-traveler DMs
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS dm_conversation_sid TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expert_admin_dms_expert ON expert_admin_dms(expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_admin_dms_admin ON expert_admin_dms(admin_id);
CREATE INDEX IF NOT EXISTS idx_expert_admin_dms_conversation ON expert_admin_dms(conversation_sid);
CREATE INDEX IF NOT EXISTS idx_inquiries_dm_conversation ON inquiries(dm_conversation_sid);

-- Add trigger to update updated_at timestamp for expert_admin_dms
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_expert_admin_dms_updated_at 
    BEFORE UPDATE ON expert_admin_dms 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for expert_admin_dms table
ALTER TABLE expert_admin_dms ENABLE ROW LEVEL SECURITY;

-- Experts and admins can view DMs they participate in
CREATE POLICY "Users can view their own DMs" ON expert_admin_dms
    FOR SELECT
    USING (auth.uid() = expert_id OR auth.uid() = admin_id);

-- Experts and admins can create DMs they participate in
CREATE POLICY "Users can create DMs they participate in" ON expert_admin_dms
    FOR INSERT
    WITH CHECK (auth.uid() = expert_id OR auth.uid() = admin_id);

-- Only participants can update their DMs
CREATE POLICY "Users can update their own DMs" ON expert_admin_dms
    FOR UPDATE
    USING (auth.uid() = expert_id OR auth.uid() = admin_id);

-- Add comments for documentation
COMMENT ON TABLE expert_admin_dms IS 'Direct message conversations between experts and admins';
COMMENT ON COLUMN expert_admin_dms.expert_id IS 'Reference to the expert user';
COMMENT ON COLUMN expert_admin_dms.admin_id IS 'Reference to the admin user';
COMMENT ON COLUMN expert_admin_dms.conversation_sid IS 'Twilio conversation SID for the DM';
COMMENT ON COLUMN inquiries.dm_conversation_sid IS 'Twilio conversation SID for admin-traveler DMs'; 