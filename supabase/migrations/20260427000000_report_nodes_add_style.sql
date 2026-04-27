-- Add reporting style field; existing columns retained for backward compatibility
ALTER TABLE report_nodes
  ADD COLUMN IF NOT EXISTS style TEXT;
