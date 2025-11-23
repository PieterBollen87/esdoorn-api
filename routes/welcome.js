// routes/welcome.js
const express = require('express');
const router = express.Router();
const db = require('../db');

/* GET current welcome HTML */
router.get('/', (req, res) => {
  db.get('SELECT html FROM welcome WHERE id = 1', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    // If the row does not exist yet, return empty string
    const html = row ? row.html : '';
    res.json({ html });
  });
});

/* PUT – replace the whole welcome HTML (expects { html: "<p>…</p>" }) */
router.put('/', express.json(), (req, res) => {
  const { html } = req.body;
  if (typeof html !== 'string')
    return res.status(400).json({ error: 'html field required' });

  const sql = `
    INSERT INTO welcome (id, html) VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET html = excluded.html
  `;
  db.run(sql, [html], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: 1, html });
  });
});

module.exports = router;