<?php
// ============================================
// EaDo Paws — GET /api/submissions.php
// View all submissions (admin use — password protected)
// ============================================

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

require_admin_auth();
header('Content-Type: application/json');

try {
    $submissions = get_all_submissions();
    echo json_encode(['success' => true, 'count' => count($submissions), 'submissions' => $submissions]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
