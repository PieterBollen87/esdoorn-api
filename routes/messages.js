// routes/messages.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { sanitizeHtml, isEmptyHtml } = require('../utils/sanitize-html');

const SELECT = 'SELECT id, title, body, showOnHome, importantAt, createdAt, updatedAt FROM messages';

/**
 * Order: important messages first, in the order they were marked important
 * (so the first important message always stays first), then the rest newest first.
 */
const ORDER = 'ORDER BY (importantAt IS NULL), importantAt ASC, createdAt DESC, id DESC';

/** MySQL returns TINYINT(1) as 0/1 – send a real true/false to the browser */
const toJson = row => (row ? { ...row, showOnHome: !!row.showOnHome, important: !!row.importantAt } : row);

/** Validate + clean the request body. Returns { title, body, showOnHome, important } or { error } */
function readPayload(reqBody = {}) {
  const title = typeof reqBody.title === 'string' ? reqBody.title.trim() : '';
  const body = sanitizeHtml(reqBody.body);
  if (!title) return { error: 'title is required' };
  if (title.length > 255) return { error: 'title is too long (max 255 characters)' };
  if (isEmptyHtml(body)) return { error: 'body is required' };
  const yes = v => v === true || v === 1;
  const important = yes(reqBody.important) ? 1 : 0;
  // An important message is always shown on the home page
  return { title, body, important, showOnHome: important || yes(reqBody.showOnHome) ? 1 : 0 };
}

/* GET /messages – all messages, newest first (public) */
router.get('/', async (req, res) => {
  try {
    const rows = await db.query(`${SELECT} ${ORDER}`);
    res.json(rows.map(toJson));
  } catch (err) {
    console.error('MESSAGES GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* GET /messages/:id – single message (public) */
router.get('/:id', async (req, res) => {
  try {
    const rows = await db.query(`${SELECT} WHERE id = ?`, [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Message not found' });
    res.json(toJson(rows[0]));
  } catch (err) {
    console.error('MESSAGES GET/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* POST /messages – create (admin) */
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const data = readPayload(req.body);
  if (data.error) return res.status(400).json({ error: data.error });
  try {
    const result = await db.query(
      'INSERT INTO messages (title, body, showOnHome, importantAt) VALUES (?, ?, ?, IF(?, NOW(), NULL))',
      [data.title, data.body, data.showOnHome, data.important]);
    const rows = await db.query(`${SELECT} WHERE id = ?`, [result.insertId]);
    res.status(201).json(toJson(rows[0]));
  } catch (err) {
    console.error('MESSAGES POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* PUT /messages/:id – update (admin) */
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const data = readPayload(req.body);
  if (data.error) return res.status(400).json({ error: data.error });
  try {
    // importantAt keeps its original time while the message stays important (so its place doesn't change)
    const result = await db.query(
      'UPDATE messages SET title = ?, body = ?, showOnHome = ?, importantAt = IF(?, COALESCE(importantAt, NOW()), NULL) WHERE id = ?',
      [data.title, data.body, data.showOnHome, data.important, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Message not found' });
    const rows = await db.query(`${SELECT} WHERE id = ?`, [id]);
    res.json(toJson(rows[0]));
  } catch (err) {
    console.error('MESSAGES PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /messages/:id – remove (admin) */
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM messages WHERE id = ?', [Number(req.params.id)]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Message not found' });
    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('MESSAGES DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
