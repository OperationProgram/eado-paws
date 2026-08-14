<?php
// ============================================
// EaDo Paws — GET /api/availability.php?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns { "2026-08-10": "available" | "full" | "blocked", ... }
// ============================================

require_once __DIR__ . '/db.php';
header('Content-Type: application/json');

$start = $_GET['start'] ?? '';
$end   = $_GET['end'] ?? '';
$dateRegex = '/^\d{4}-\d{2}-\d{2}$/';

if (!$start || !$end || !preg_match($dateRegex, $start) || !preg_match($dateRegex, $end)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'start and end must be YYYY-MM-DD.']);
    exit;
}

try {
    $blocked = get_blocked_dates_in_range($start, $end);
    $dayCounts = get_booking_counts_by_date_range($start, $end);

    $blockedSet = array_flip(array_column($blocked, 'date'));
    $countByDate = array_column($dayCounts, 'count', 'preferred_date');

    $availability = [];
    $cursor = new DateTime($start);
    $endDate = new DateTime($end);
    while ($cursor <= $endDate) {
        $dateStr = $cursor->format('Y-m-d');
        if (isset($blockedSet[$dateStr])) {
            $availability[$dateStr] = 'blocked';
        } elseif (($countByDate[$dateStr] ?? 0) >= MAX_BOOKINGS_PER_DAY) {
            $availability[$dateStr] = 'full';
        } else {
            $availability[$dateStr] = 'available';
        }
        $cursor->modify('+1 day');
    }

    echo json_encode(['success' => true, 'availability' => $availability]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
