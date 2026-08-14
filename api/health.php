<?php
// ============================================
// EaDo Paws — GET /api/health.php
// Quick health check
// ============================================

header('Content-Type: application/json');
echo json_encode([
    'status' => 'ok',
    'service' => 'EADO Paws API',
    'timestamp' => date('c'),
]);
