const express = require('express');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'grafcoin2024';
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(__dirname, 'db.json');

// ---- Setup directories ----
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ---- JSON file database ----
function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) return [];
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

function writeDb(records) {
  fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf8');
}

// ---- Middleware ----
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// ---- Rate limiter: 3 saves per hour per IP ----
const graffitiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Limit: 3 graffiti per hour. Try again later.' },
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown'
});

// ---- Routes ----

// GET /api/graffiti
app.get('/api/graffiti', (req, res) => {
  try {
    const records = readDb();
    const result = records
      .sort((a, b) => b.created_at - a.created_at)
      .map(({ id, author, created_at }) => ({ id, author, created_at }));
    res.json(result);
  } catch (err) {
    console.error('GET /api/graffiti error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/graffiti
app.post('/api/graffiti', graffitiLimiter, (req, res) => {
  try {
    let { imageData, author } = req.body;

    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({ error: 'Missing image data.' });
    }
    if (!imageData.startsWith('data:image/png;base64,')) {
      return res.status(400).json({ error: 'Invalid image format. Expected PNG.' });
    }

    const base64Data = imageData.replace('data:image/png;base64,', '');
    const fileSizeBytes = Buffer.byteLength(base64Data, 'base64');
    if (fileSizeBytes > 8 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large. Maximum size is 8MB.' });
    }

    author = author ? String(author).trim().slice(0, 50) : '';
    if (!author) author = 'Anonymous';

    const id = uuidv4();
    const filePath = path.join(UPLOADS_DIR, `${id}.png`);
    const createdAt = Date.now();

    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    const records = readDb();
    records.push({ id, author, ip: req.ip, created_at: createdAt });
    writeDb(records);

    res.json({ id, author, created_at: createdAt });
  } catch (err) {
    console.error('POST /api/graffiti error:', err);
    res.status(500).json({ error: 'Internal server error while saving.' });
  }
});

// DELETE /api/graffiti/:id
app.delete('/api/graffiti/:id', (req, res) => {
  try {
    const { password } = req.body;
    const { id } = req.params;

    if (!password || password !== ADMIN_PASSWORD) {
      return res.status(403).json({ error: 'Invalid admin password.' });
    }

    const records = readDb();
    const index = records.findIndex(r => r.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Graffiti not found.' });
    }

    records.splice(index, 1);
    writeDb(records);

    const filePath = path.join(UPLOADS_DIR, `${id}.png`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/graffiti error:', err);
    res.status(500).json({ error: 'Internal server error while deleting.' });
  }
});

// POST /api/admin/verify
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  res.json({ valid: password === ADMIN_PASSWORD });
});

// ---- Start ----
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('   GRAFCOIN SERVER RUNNING');
  console.log('========================================');
  console.log(`   URL:      http://localhost:${PORT}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Uploads:  ${UPLOADS_DIR}`);
  console.log(`   Database: ${DB_FILE}`);
  console.log('========================================\n');
});
