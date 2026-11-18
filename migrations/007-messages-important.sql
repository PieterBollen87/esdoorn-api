-- migrations/007-messages-important.sql  (MySQL) – run BEFORE deploying the API code that uses it
-- "Belangrijk": important messages come first on the home page, in the order they were marked important.
ALTER TABLE messages
    ADD COLUMN importantAt DATETIME NULL DEFAULT NULL AFTER showOnHome;

-- "Beste patiënten" is the first important message (and therefore always first)
UPDATE messages SET importantAt = NOW(), showOnHome = 1 WHERE title = 'Beste patiënten';
