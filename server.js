const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Serve static frontend files directly from the current directory
app.use(express.static(path.join(__dirname)));

const db = new sqlite3.Database('./leaderboard.db', (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Create leaderboard table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    cookies REAL NOT NULL,
    cps REAL NOT NULL,
    skin TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);


// Health check endpoint for Render
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// GET /api/leaderboard - Fetch top 50 players by total cookies
app.get('/api/leaderboard', (req, res) => {
  const query = `
    SELECT username, cookies, cps, skin, updated_at 
    FROM leaderboard 
    ORDER BY cookies DESC 
    LIMIT 50
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching leaderboard:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve leaderboard data.' });
    }
    res.json(rows);
  });
});

// POST /api/leaderboard - Submit or update player score
app.post('/api/leaderboard', (req, res) => {
  const { username, cookies, cps, skin } = req.body;

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({ error: 'Valid username is required.' });
  }

  const cleanName = username.trim().slice(0, 20); // Limit name to 20 chars
  const numCookies = Number(cookies) || 0;
  const numCps = Number(cps) || 0;
  const cleanSkin = (skin || 'Classic').slice(0, 30);

  const query = `
    INSERT INTO leaderboard (username, cookies, cps, skin, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(username) DO UPDATE SET
      cookies = MAX(leaderboard.cookies, excluded.cookies),
      cps = MAX(leaderboard.cps, excluded.cps),
      skin = excluded.skin,
      updated_at = CURRENT_TIMESTAMP
  `;

  db.run(query, [cleanName, numCookies, numCps, cleanSkin], function (err) {
    if (err) {
      console.error('Error submitting score:', err.message);
      return res.status(500).json({ error: 'Failed to save score.' });
    }
    res.json({ success: true, message: 'Score updated successfully!' });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
