-- Run this once on the live database to update business details
INSERT INTO settings (setting_key, setting_value) VALUES
  ('bank_name',         'Union Bank'),
  ('bank_account_name', 'Mc-Jacob Global Farms Ltd'),
  ('bank_account_number','0164472977'),
  ('whatsapp_number',   '2347044784949'),
  ('company_phone',     '07044784949'),
  ('company_email',     'info@mcjacobfoods.com'),
  ('company_address',   '')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
