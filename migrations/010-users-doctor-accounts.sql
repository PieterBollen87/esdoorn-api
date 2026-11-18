-- migrations/010-users-doctor-accounts.sql  (MySQL) – run BEFORE deploying the API code that uses it
-- Doctor accounts: role 'doctor' + link to the doctor (one account per doctor). Usernames must be unique.
-- No FOREIGN KEY: the database user may not create one (#1044). Instead routes/doctors.js deletes
-- the account when the doctor is deleted.
ALTER TABLE users
    MODIFY role ENUM('admin', 'user', 'doctor') NOT NULL DEFAULT 'user',
    ADD COLUMN doctorId INT NULL DEFAULT NULL AFTER role,
    ADD UNIQUE KEY uq_users_username (username),
    ADD UNIQUE KEY uq_users_doctor (doctorId);
