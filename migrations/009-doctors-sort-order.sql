-- migrations/009-doctors-sort-order.sql  (MySQL) – run BEFORE deploying the API code that uses it
-- Order of the doctors set in the admin (drag & drop). Starts as the current order (by id).
ALTER TABLE doctors
    ADD COLUMN sortOrder INT NOT NULL DEFAULT 0;
UPDATE doctors SET sortOrder = id;
