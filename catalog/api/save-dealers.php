<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method'], JSON_UNESCAPED_UNICODE);
    exit;
}

cromax_require_capability('dealers');

if (!cromax_request_origin_matches_host()) {
    cromax_write_audit_log('save_dealers_rejected', ['reason' => 'origin_mismatch']);
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'origin_mismatch'], JSON_UNESCAPED_UNICODE);
    exit;
}

$csrfHeader = cromax_request_header('X-New Site-CSRF');
$csrfSession = isset($_SESSION['cromax_csrf_token']) && is_string($_SESSION['cromax_csrf_token'])
    ? $_SESSION['cromax_csrf_token']
    : '';
if ($csrfHeader === '' || $csrfSession === '' || !hash_equals($csrfSession, $csrfHeader)) {
    cromax_write_audit_log('save_dealers_rejected', ['reason' => 'csrf_failed']);
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'csrf_failed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$rate = cromax_rate_limit_check('save_dealers', 10, 60);
if (!$rate['allowed']) {
    $retryAfter = max(1, (int) $rate['retry_after']);
    header('Retry-After: ' . $retryAfter);
    cromax_write_audit_log('save_dealers_rejected', ['reason' => 'rate_limited', 'retry_after' => $retryAfter]);
    http_response_code(429);
    echo json_encode(
        ['ok' => false, 'error' => 'rate_limited', 'retry_after' => $retryAfter],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

$raw = file_get_contents('php://input');
$data = is_string($raw) ? json_decode($raw, true) : null;
if (!is_array($data)) {
    cromax_write_audit_log('save_dealers_rejected', ['reason' => 'invalid_json']);
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!cromax_write_dealers($data)) {
    cromax_write_audit_log('save_dealers_failed', ['reason' => 'write_failed']);
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'write_failed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$savedDoc = cromax_read_dealers();
$regions = isset($savedDoc['byRegionId']) && is_array($savedDoc['byRegionId']) ? $savedDoc['byRegionId'] : [];
$cards = 0;
foreach ($regions as $rows) {
    if (is_array($rows)) {
        $cards += count($rows);
    }
}
cromax_write_audit_log('save_dealers_success', ['regions' => count($regions), 'cards' => $cards]);

echo json_encode(['ok' => true, 'doc' => $savedDoc], JSON_UNESCAPED_UNICODE);
