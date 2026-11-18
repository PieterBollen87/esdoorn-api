// routes/messages.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { sanitizeHtml, isEmptyHtml } = require('../utils/sanitize-html');

const SELECT = 'SELECT id, title, body, createdAt, updatedAt FROM messages';

/** Validate + clean the request body. Returns { title, body } or { error } */
function readPayload(reqBody = {}) {
  const title = typeof reqBody.title === 'string' ? reqBody.title.trim() : '';
  const body = sanitizeHtml(reqBody.body);
  if (!title) return { error: 'title is required' };
  if (title.length > 255) return { error: 'title is too long (max 255 characters)' };
  if (isEmptyHtml(body)) return { error: 'body is required' };
  return { title, body };
}

/* GET /messages – all messages, newest first (public) */
router.get('/', async (req, res) => {
  try {
    const rows = await db.query(`${SELECT} ORDER BY createdAt DESC, id DESC`);
    res.json(rows);
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
    res.json(rows[0]);
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
    const result = await db.query('INSERT INTO messages (title, body) VALUES (?, ?)', [data.title, data.body]);
    const rows = await db.query(`${SELECT} WHERE id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
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
    const result = await db.query('UPDATE messages SET title = ?, body = ? WHERE id = ?', [data.title, data.body, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Message not found' });
    const rows = await db.query(`${SELECT} WHERE id = ?`, [id]);
    res.json(rows[0]);
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
