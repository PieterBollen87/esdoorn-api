// routes/welcome.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

/**
 * GET /welcome
 * Returns the current welcome HTML (singleton row with id = 1).
 */
router.get('/', async (req, res) => {
  try {
    const row = await db.get('SELECT html FROM welcome WHERE id = 1');
    // If the row does not exist yet, return an empty string
    const html = row ? row.html : '';
    res.json({ html });
  } catch (err) {
    console.error('WELCOME GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /welcome
 * Updates (or creates) the welcome HTML.
 * Body: { html: "<p>…</p>" }
 */
router.put('/', verifyToken, requireAdmin, async (req, res) => {
  const { html } = req.body;
  if (typeof html !== 'string') {
    return res.status(400).json({ error: 'html field required' });
  }

  const sql = `
    INSERT INTO welcome (id, html) VALUES (1, ?)
    ON DUPLICATE KEY UPDATE html = VALUES(html)
  `;

  try {
    await db.run(sql, [html]);
    res.json({ id: 1, html });
  } catch (err) {
    console.error('WELCOME PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;