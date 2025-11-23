// routes/urgency.js
const express = require('express');
const router = express.Router();
const db = require('../db');

/* GET current urgency HTML */
router.get('/', (req, res) => {
  db.get('SELECT html FROM urgency WHERE id = 1', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    const html = row ? row.html : '';
    res.json({ html });
  });
});

/* PUT – replace urgency HTML (expects { html: "<p>…</p>" }) */
router.put('/', express.json(), (req, res) => {
  const { html } = req.body;
  if (typeof html !== 'string')
    return res.status(400).json({ error: 'html field required' });

  const sql = `
    INSERT INTO urgency (id, html) VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET html = excluded.html
  `;
  db.run(sql, [html], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: 1, html });
  });
});

module.exports = router;