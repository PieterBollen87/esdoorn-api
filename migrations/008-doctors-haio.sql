-- migrations/008-doctors-haio.sql  (MySQL) – run BEFORE deploying the API code that uses it
-- HAIO = huisarts in opleiding. Listed after the other doctors; "Vertegenwoordigers" always last.
ALTER TABLE doctors
    ADD COLUMN haio TINYINT(1) NOT NULL DEFAULT 0;
