<?php
// ============================================
// EaDo Paws — Blocked dates admin
// Days you're taking zero bookings (vacation, etc.)
// ============================================

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

require_admin_auth();
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $blocked = get_blocked_dates_in_range('0000-01-01', '9999-12-31');
        echo json_encode(['success' => true, 'blocked' => $blocked]);

    } elseif ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $date = $body['date'] ?? '';
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'date must be YYYY-MM-DD.']);
            exit;
        }
        add_blocked_date($date, $body['reason'] ?? null);
        echo json_encode(['success' => true]);

    } elseif ($method === 'DELETE') {
        // Expect /api/blocked-dates.php?date=YYYY-MM-DD
        $date = $_GET['date'] ?? '';
        remove_blocked_date($date);
        echo json_encode(['success' => true]);

    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
