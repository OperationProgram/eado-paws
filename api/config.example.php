<?php
// ============================================
// EaDo Paws — API config template
// Copy this file to config.php and fill in real values.
// NEVER commit config.php to git!
// ============================================

// --- MySQL database (hPanel > Databases > MySQL Databases) ---
define('DB_HOST', 'localhost');
define('DB_NAME', 'REPLACE_WITH_DB_NAME');
define('DB_USER', 'REPLACE_WITH_DB_USER');
define('DB_PASS', 'REPLACE_WITH_DB_PASSWORD');

// --- Email (Hostinger mailbox for pets@eadopaws.com) ---
define('SMTP_HOST', 'smtp.hostinger.com');
define('SMTP_PORT', 465);
define('EMAIL_USER', 'pets@eadopaws.com');
define('EMAIL_PASS', 'REPLACE_WITH_MAILBOX_PASSWORD');

// Comma-separated list — supports multiple recipients.
define('EMAIL_TO', 'spencerrholan2020@gmail.com,pets@eadopaws.com');

// Carrier email-to-SMS gateway. Leave as '' to disable.
// AT&T: @txt.att.net  T-Mobile: @tmomail.net  Verizon: @vtext.com
define('SMS_GATEWAY', '8322169276@tmomail.net');

// Max free meet-&-greets accepted per day.
define('MAX_BOOKINGS_PER_DAY', 4);

// --- Admin auth for /api/submissions.php and /api/blocked-dates.php ---
// Basic HTTP auth — browser will prompt for these when you visit those URLs.
define('ADMIN_USER', 'REPLACE_WITH_ADMIN_USERNAME');
define('ADMIN_PASS', 'REPLACE_WITH_A_STRONG_PASSWORD');
