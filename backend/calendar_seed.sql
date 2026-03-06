-- Seed Holidays
INSERT INTO holidays (name, date, is_recurring) VALUES 
('New Year Day', '2026-01-01', true),
('Labour Day', '2026-05-01', true),
('Independence Day', '2026-08-14', true),
('Christmas Day', '2026-12-25', true),
('Eid-ul-Fitr', '2026-03-20', false), -- Approximate
('Eid-ul-Adha', '2026-05-27', false); -- Approximate

-- Seed some Time Off Requests (Assuming member IDs from existing members)
-- I'll use a subquery to get real member IDs
DO $$
DECLARE
    m1 UUID;
    m2 UUID;
BEGIN
    SELECT id INTO m1 FROM members LIMIT 1;
    SELECT id INTO m2 FROM members OFFSET 1 LIMIT 1;

    IF m1 IS NOT NULL THEN
        INSERT INTO time_off_requests (member_id, start_date, end_date, type, status, reason)
        VALUES (m1, '2026-03-10', '2026-03-12', 'Vacation', 'Approved', 'Family trip to the mountains.');
    END IF;

    IF m2 IS NOT NULL THEN
        INSERT INTO time_off_requests (member_id, start_date, end_date, type, status, reason)
        VALUES (m2, '2026-03-15', '2026-03-15', 'Sick', 'Approved', 'Doctor appointment and rest.');
        
        INSERT INTO time_off_requests (member_id, start_date, end_date, type, status, reason)
        VALUES (m2, '2026-03-25', '2026-03-27', 'Personal', 'Pending', 'Personal errands and banking.');
    END IF;
END $$;
