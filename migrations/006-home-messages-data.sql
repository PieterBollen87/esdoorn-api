-- migrations/006-home-messages-data.sql  (MySQL) – one-time data, run AFTER 005
-- 1) "Beste patiënten" (was hard-coded on the home page) becomes a normal message, shown on home
-- 2) all existing messages are shown on home as well (they can be unticked in the admin later)
SET NAMES utf8mb4;

UPDATE messages SET showOnHome = 1;

INSERT INTO messages (title, body, showOnHome)
SELECT 'Beste patiënten', '<h3><p>Opgelet:</p></h3><div><p><u><b><span class="hl">Telefonische vragen: houd het kort.</span></b></u><br>We ervaren een enorme telefonische overlast tijdens de consultaties.<br>Maak bij voorkeur een <u><b><a href="#work">afspraak</a></b></u>, ook voor het invullen van documenten en het voorschrijven van medicatie.</p></div><p>Alvast bedankt voor uw medewerking.</p>', 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM messages WHERE title = 'Beste patiënten');
