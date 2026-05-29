<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

try {
    require __DIR__ . '/bootstrap.php';
} catch (Throwable $e) {
    error_log('cromax login bootstrap: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'bootstrap_failed'], JSON_UNESCAPED_UNICODE);

    exit;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'method'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $raw = file_get_contents('php://input');
    $data = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid_json'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $user = isset($data['user']) && is_string($data['user']) ? trim($data['user']) : '';
    $pass = isset($data['password']) && is_string($data['password']) ? $data['password'] : '';

    if ($user === '' || $pass === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'missing_credentials'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $accounts = cromax_load_user_accounts();
    if ($accounts === []) {
        http_response_code(503);
        echo json_encode(['ok' => false, 'error' => 'not_configured'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!isset($accounts[$user]['password']) || !password_verify($pass, $accounts[$user]['password'])) {
        cromax_write_audit_log('login_failed', ['reason' => 'invalid_credentials', 'user' => $user]);
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'invalid_credentials'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    @session_regenerate_id(true);
    $_SESSION['cromax_editor'] = $user;
    $csrfToken = cromax_session_csrf_token(true);
    cromax_write_audit_log('login_success', ['user' => $user]);

    $caps = $accounts[$user]['capabilities'] ?? cromax_editor_capability_ids();

    $payload = [
        'ok' => true,
        'user' => $user,
        'csrfToken' => $csrfToken,
        'capabilities' => $caps,
    ];
    $flags = JSON_UNESCAPED_UNICODE;
    if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
        $flags |= JSON_INVALID_UTF8_SUBSTITUTE;
    }
    $encoded = json_encode($payload, $flags);
    if (!is_string($encoded)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'encode_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo $encoded;
} catch (Throwable $e) {
    error_log('cromax login: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'server_exception'], JSON_UNESCAPED_UNICODE);
}
