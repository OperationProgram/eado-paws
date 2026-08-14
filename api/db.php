<?php
// ============================================
// EaDo Paws — Database (PDO)
// MySQL in production. Supports a local SQLite fallback for dev
// testing when DB_DRIVER is defined as 'sqlite' in config.php.
// ============================================

require_once __DIR__ . '/config.php';

function get_pdo() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $driver = defined('DB_DRIVER') ? DB_DRIVER : 'mysql';

    if ($driver === 'sqlite') {
        $path = defined('DB_PATH') ? DB_PATH : __DIR__ . '/data.sqlite';
        $pdo = new PDO('sqlite:' . $path);
    } else {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS);
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    init_schema($pdo, $driver);
    return $pdo;
}

function init_schema($pdo, $driver) {
    if ($driver === 'sqlite') {
        $pdo->exec("
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
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS blocked_dates (
                date    TEXT PRIMARY KEY,
                reason  TEXT
            )
        ");
    } else {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS submissions (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                first_name      VARCHAR(100) NOT NULL,
                last_name       VARCHAR(100) NOT NULL,
                email           VARCHAR(255) NOT NULL,
                phone           VARCHAR(50),
                dog_name        VARCHAR(100),
                dog_breed       VARCHAR(100),
                service         VARCHAR(100),
                preferred_date  VARCHAR(10),
                preferred_time  VARCHAR(50),
                message         TEXT,
                status          VARCHAR(20) DEFAULT 'new',
                created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS blocked_dates (
                date    VARCHAR(10) PRIMARY KEY,
                reason  VARCHAR(255)
            )
        ");
    }
}

// === COUNT BOOKINGS PER DAY IN A RANGE (for calendar availability) ===
function get_booking_counts_by_date_range($startDate, $endDate) {
    $stmt = get_pdo()->prepare(
        "SELECT preferred_date, COUNT(*) as count
         FROM submissions
         WHERE preferred_date BETWEEN ? AND ?
         GROUP BY preferred_date"
    );
    $stmt->execute([$startDate, $endDate]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// === BLOCKED DATES ===
function get_blocked_dates_in_range($startDate, $endDate) {
    $stmt = get_pdo()->prepare(
        "SELECT date, reason FROM blocked_dates WHERE date BETWEEN ? AND ?"
    );
    $stmt->execute([$startDate, $endDate]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function add_blocked_date($date, $reason) {
    $driver = defined('DB_DRIVER') ? DB_DRIVER : 'mysql';
    $sql = $driver === 'sqlite'
        ? "INSERT OR REPLACE INTO blocked_dates (date, reason) VALUES (?, ?)"
        : "REPLACE INTO blocked_dates (date, reason) VALUES (?, ?)";
    $stmt = get_pdo()->prepare($sql);
    $stmt->execute([$date, $reason ?: null]);
}

function remove_blocked_date($date) {
    $stmt = get_pdo()->prepare("DELETE FROM blocked_dates WHERE date = ?");
    $stmt->execute([$date]);
}

// === SAVE A SUBMISSION ===
function save_submission($data) {
    $stmt = get_pdo()->prepare("
        INSERT INTO submissions
            (first_name, last_name, email, phone, dog_name, dog_breed, service, preferred_date, preferred_time, message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $data['firstName'], $data['lastName'], $data['email'],
        $data['phone'] ?? null, $data['dogName'] ?? null, $data['dogBreed'] ?? null,
        $data['service'] ?? null, $data['preferredDate'] ?? null,
        $data['preferredTime'] ?? null, $data['message'] ?? null,
    ]);
    return get_pdo()->lastInsertId();
}

// === GET ALL SUBMISSIONS ===
function get_all_submissions() {
    $stmt = get_pdo()->query("SELECT * FROM submissions ORDER BY created_at DESC");
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
