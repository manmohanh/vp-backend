-- Fix status column length to accommodate new status values
-- "cancelled_by_passenger" and "cancelled_by_rider" are 23 characters

-- Increase bookings status column from varchar(20) to varchar(30)
ALTER TABLE bookings 
ALTER COLUMN status TYPE varchar(30);

-- Increase trips status column from varchar(20) to varchar(30)
ALTER TABLE trips 
ALTER COLUMN status TYPE varchar(30);

-- Verify the changes
SELECT 
    table_name, 
    column_name, 
    character_maximum_length 
FROM information_schema.columns 
WHERE table_name IN ('bookings', 'trips') 
  AND column_name = 'status';
