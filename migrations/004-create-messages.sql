-- migrations/004-create-messages.sql  (MySQL)
CREATE TABLE IF NOT EXISTS messages (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    title     VARCHAR(255) NOT NULL,
    body      MEDIUMTEXT   NOT NULL,   -- sanitized HTML (b, i, u, a, span.hl, p, br, div)
    createdAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) DEFAULT CHARSET = utf8mb4;
