// routes/urgency.js
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /urgency
 * Returns the current urgency HTML (singleton row with id = 1).
 */
router.get('/', async (req, res) => {
  try {
    const row = await db.get('SELECT html FROM urgency WHERE id = 1');
    const html = row ? row.html : '';
    res.json({ html });
  } catch (err) {
    console.error('URGENCY GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /urgency
 * Updates (or creates) the urgency HTML.
 * Body: { html: "<p>…</p>" }
 */
router.put('/', async (req, res) => {
  const { html } = req.body;
  if (typeof html !== 'string') {
    return res.status(400).json({ error: 'html field required' });
  }

  const sql = `
    INSERT INTO urgency (id, html) VALUES (1, ?)
    ON DUPLICATE KEY UPDATE html = VALUES(html)
  `;

  try {
    await db.run(sql, [html]);
    res.json({ id: 1, html });
  } catch (err) {
    console.error('URGENCY PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;