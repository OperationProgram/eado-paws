<?php
// ============================================
// EaDo Paws — Simple HTTP Basic Auth for admin endpoints
// ============================================

require_once __DIR__ . '/config.php';

function require_admin_auth() {
    $user = $_SERVER['PHP_AUTH_USER'] ?? '';
    $pass = $_SERVER['PHP_AUTH_PW'] ?? '';

    if (!hash_equals(ADMIN_USER, $user) || !hash_equals(ADMIN_PASS, $pass)) {
        header('WWW-Authenticate: Basic realm="EADO Paws Admin"');
        header('Content-Type: application/json');
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Authentication required.']);
        exit;
    }
}
