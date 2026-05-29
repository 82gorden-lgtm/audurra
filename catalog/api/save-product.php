<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method'], JSON_UNESCAPED_UNICODE);
    exit;
}

cromax_require_capability('catalog');

$raw = file_get_contents('php://input');
$data = is_string($raw) ? json_decode($raw, true) : null;
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json'], JSON_UNESCAPED_UNICODE);
    exit;
}

$sku = isset($data['sku']) ? trim((string) $data['sku']) : '';
$patch = isset($data['patch']) && is_array($data['patch']) ? $data['patch'] : [];

if ($sku === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'missing_sku'], JSON_UNESCAPED_UNICODE);
    exit;
}

$all = cromax_read_overrides();
$prev = isset($all[$sku]) && is_array($all[$sku]) ? $all[$sku] : [];
$merged = cromax_merge_product_patch($prev, $patch);
$all[$sku] = $merged;

if (!cromax_write_overrides($all)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'write_failed'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['ok' => true, 'sku' => $sku], JSON_UNESCAPED_UNICODE);
