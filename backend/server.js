
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const multer   = require('multer');
const sqlite3  = require('sqlite3').verbose();
const path     = require('path');
const fs       = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database ──────────────────────────────────────────
const db = new sqlite3.Database('./birthday.db', (err) => {
  if (err) console.error('DB hatası:', err.message);
  else console.log('Veritabanı bağlandı.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    author     TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS photos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    filename   TEXT NOT NULL,
    caption    TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// ── Middleware ────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename:    (_, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ── MESAJ ROUTES ──────────────────────────────────────
app.get('/api/messages', (req, res) => {
  db.all('SELECT * FROM messages ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/messages', (req, res) => {
  const { author, content } = req.body;
  if (!author?.trim() || !content?.trim())
    return res.status(400).json({ error: 'İsim ve mesaj zorunlu.' });

  db.run(
    'INSERT INTO messages (author, content) VALUES (?, ?)',
    [author.trim(), content.trim()],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, author, content });
    }
  );
});

// ── FOTOĞRAF ROUTES ───────────────────────────────────
app.get('/api/photos', (req, res) => {
  db.all('SELECT * FROM photos ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, url: `/uploads/${r.filename}` })));
  });
});

app.post('/api/photos', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Dosya yok.' });
  const caption = req.body.caption || '';
  db.run(
    'INSERT INTO photos (filename, caption) VALUES (?, ?)',
    [req.file.filename, caption],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, url: `/uploads/${req.file.filename}`, caption });
    }
  );
});

app.listen(PORT, () => console.log(`Sunucu çalışıyor: http://localhost:${PORT}`));