<?php
// ============================================
// EaDo Paws — POST /api/contact.php
// Handles the booking/contact form submission
// ============================================

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];

$firstName     = trim($body['first-name'] ?? '');
$lastName      = trim($body['last-name'] ?? '');
$email         = trim($body['email'] ?? '');
$phone         = trim($body['phone'] ?? '');
$dogName       = trim($body['dog-name'] ?? '');
$dogBreed      = trim($body['dog-breed'] ?? '');
$service       = trim($body['service'] ?? '');
$preferredDate = trim($body['preferred-date'] ?? '');
$preferredTime = trim($body['preferred-time'] ?? '');
$message       = trim($body['message'] ?? '');

// --- Basic validation ---
if (!$firstName || !$lastName || !$email) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'First name, last name, and email are required.']);
    exit;
}

if ($preferredDate && $preferredDate < date('Y-m-d')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Preferred date must be today or later.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Please provide a valid email address.']);
    exit;
}

// --- Make sure the requested day is actually bookable ---
if ($preferredDate) {
    $blocked = get_blocked_dates_in_range($preferredDate, $preferredDate);
    if (count($blocked) > 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'That date is not available. Please pick a different day.']);
        exit;
    }
    $dayCounts = get_booking_counts_by_date_range($preferredDate, $preferredDate);
    $existingCount = $dayCounts[0]['count'] ?? 0;
    if ($existingCount >= MAX_BOOKINGS_PER_DAY) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'That date is fully booked. Please pick a different day.']);
        exit;
    }
}

try {
    // --- 1. Save to database ---
    $submissionId = save_submission([
        'firstName' => $firstName, 'lastName' => $lastName, 'email' => $email,
        'phone' => $phone, 'dogName' => $dogName, 'dogBreed' => $dogBreed,
        'service' => $service, 'preferredDate' => $preferredDate,
        'preferredTime' => $preferredTime, 'message' => $message,
    ]);

    // --- 2. Send notification email to you ---
    send_owner_notification([
        'submissionId' => $submissionId, 'firstName' => $firstName, 'lastName' => $lastName,
        'email' => $email, 'phone' => $phone, 'dogName' => $dogName, 'dogBreed' => $dogBreed,
        'service' => $service, 'preferredDate' => $preferredDate, 'preferredTime' => $preferredTime,
        'message' => $message,
    ]);

    // --- 3. Send confirmation email to the customer ---
    send_customer_confirmation($firstName, $email, $dogName, $service);

    // --- 4. Text alert (best-effort — never fails the booking) ---
    send_text_alert($firstName, $lastName, $dogName, $preferredDate);

    echo json_encode([
        'success' => true,
        'message' => "Thanks {$firstName}! We'll be in touch within a few hours. 🐾",
        'submissionId' => $submissionId,
    ]);
} catch (Throwable $e) {
    error_log('Submission error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Something went wrong. Please try again or call us directly.']);
}
