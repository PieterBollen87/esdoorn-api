-- migrations/011-users-secretary-role.sql  (MySQL) – run BEFORE deploying the API code that uses it
-- New role 'secretary' (secretariaat): messages, doctors, everyone's leave, creating doctor accounts.
ALTER TABLE users
    MODIFY role ENUM('admin', 'user', 'doctor', 'secretary') NOT NULL DEFAULT 'user';
