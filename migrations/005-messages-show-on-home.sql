-- migrations/005-messages-show-on-home.sql  (MySQL)
-- Lets the admin choose which messages appear on the home page (checkbox "Op home").
-- Run this BEFORE deploying the API code that uses the column.
ALTER TABLE messages
    ADD COLUMN showOnHome TINYINT(1) NOT NULL DEFAULT 0 AFTER body;
