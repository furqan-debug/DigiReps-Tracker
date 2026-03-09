-- -----------------------------------------------------------------------------
-- Seed Data for Reports
-- -----------------------------------------------------------------------------
-- Run this in Supabase SQL Editor AFTER the main schema

-- Add some dummy payments (requires existing members)
-- If you have members, replace the uuids below or let it fail gracefully if no members exist
DO $$
DECLARE
    m1_id UUID;
    m2_id UUID;
BEGIN
    SELECT id INTO m1_id FROM members LIMIT 1;
    SELECT id INTO m2_id FROM members OFFSET 1 LIMIT 1;
 
    IF m1_id IS NOT NULL THEN
        INSERT INTO payments (member_id, amount, status, method, reference, paid_at)
        VALUES 
        (m1_id, 1250.00, 'Completed', 'Bank Transfer', 'TXN-992831', now() - interval '2 days'),
        (m1_id, 800.00, 'Pending', 'PayPal', 'PP-Pending-01', NULL);
    END IF;
    
    
    IF m2_id IS NOT NULL THEN
        INSERT INTO payments (member_id, amount, status, method, reference, paid_at)
        VALUES 
        (m2_id, 3200.50, 'Completed', 'Stripe', 'ST-882192', now() - interval '5 days');
    END IF;
END $$;

-- Add some custom report configurations
INSERT INTO custom_reports (name, type, filters, is_favorite)
VALUES 
('Q1 Development Costs', 'Financial', '{"projects": ["Mobile App", "Web App"], "dateRange": "Q1 2026"}', true),
('Weekly Activity Audit', 'Time', '{"team": "Engineering", "activityThreshold": 70}', true),
('Client Billing Summary', 'Financial', '{"client": "TechCorp", "month": "February"}', false),
('High Idle Alert Report', 'Team', '{"idleThreshold": 20, "notify": true}', false);

-- -----------------------------------------------------------------------------
-- End Seed
-- -----------------------------------------------------------------------------
