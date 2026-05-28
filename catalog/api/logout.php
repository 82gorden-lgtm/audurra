<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method'], JSON_UNESCAPED_UNICODE);
    exit;
}

$wasUser = isset($_SESSION['cromax_editor']) && is_string($_SESSION['cromax_editor'])
    ? $_SESSION['cromax_editor']
    : null;

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', (bool) ($p['secure'] ?? false), (bool) ($p['httponly'] ?? true));
}
session_destroy();

if ($wasUser !== null) {
    cromax_write_audit_log('logout', ['user' => $wasUser]);
}

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
