// ============================================
// EaDo Paws — Database (SQLite)
// Lightweight, file-based, zero config
// ============================================

const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const DB_PATH = path.join(__dirname, 'data', 'eadopaws.db');

// Ensure the data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// Create/open the database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
  } else {
    console.log('📦 Database connected:', DB_PATH);
    initSchema();
  }
});

// === CREATE TABLE IF NOT EXISTS ===
function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name      TEXT NOT NULL,
      last_name       TEXT NOT NULL,
      email           TEXT NOT NULL,
      phone           TEXT,
      dog_name        TEXT,
      dog_breed       TEXT,
      service         TEXT,
      preferred_date  TEXT,
      preferred_time  TEXT,
      message         TEXT,
      status          TEXT DEFAULT 'new',
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) { console.error('Schema error:', err.message); return; }
    console.log('✅ Submissions table ready');
    // Migration for databases created before preferred_date/preferred_time existed.
    db.run(`ALTER TABLE submissions ADD COLUMN preferred_date TEXT`, () => {});
    db.run(`ALTER TABLE submissions ADD COLUMN preferred_time TEXT`, () => {});
  });

  // Days you're not taking any bookings at all (vacation, days off, etc.)
  db.run(`
    CREATE TABLE IF NOT EXISTS blocked_dates (
      date    TEXT PRIMARY KEY,
      reason  TEXT
    )
  `, (err) => {
    if (err) console.error('Schema error:', err.message);
    else console.log('✅ Blocked dates table ready');
  });
}

// === COUNT BOOKINGS PER DAY IN A RANGE (for calendar availability) ===
function getBookingCountsByDateRange(startDate, endDate) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT preferred_date, COUNT(*) as count
       FROM submissions
       WHERE preferred_date BETWEEN ? AND ?
       GROUP BY preferred_date`,
      [startDate, endDate],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

// === BLOCKED DATES ===
function getBlockedDatesInRange(startDate, endDate) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT date, reason FROM blocked_dates WHERE date BETWEEN ? AND ?`,
      [startDate, endDate],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function addBlockedDate(date, reason) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO blocked_dates (date, reason) VALUES (?, ?)`,
      [date, reason || null],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function removeBlockedDate(date) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM blocked_dates WHERE date = ?`, [date], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// === SAVE A SUBMISSION ===
function saveSubmission({ firstName, lastName, email, phone, dogName, dogBreed, service, preferredDate, preferredTime, message }) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO submissions (first_name, last_name, email, phone, dog_name, dog_breed, service, preferred_date, preferred_time, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(sql, [firstName, lastName, email, phone || null, dogName || null, dogBreed || null, service || null, preferredDate || null, preferredTime || null, message || null], function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

// === GET ALL SUBMISSIONS ===
function getAllSubmissions() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM submissions ORDER BY created_at DESC`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  saveSubmission,
  getAllSubmissions,
  getBookingCountsByDateRange,
  getBlockedDatesInRange,
  addBlockedDate,
  removeBlockedDate,
};
