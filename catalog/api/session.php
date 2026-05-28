<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$user = !empty($_SESSION['cromax_editor']) && is_string($_SESSION['cromax_editor'])
    ? $_SESSION['cromax_editor']
    : null;
$csrfToken = $user !== null ? cromax_session_csrf_token() : null;
$caps = $user !== null ? cromax_current_editor_capabilities() : [];

echo json_encode([
    'ok' => $user !== null,
    'user' => $user,
    'csrfToken' => $csrfToken,
    'capabilities' => $caps,
], JSON_UNESCAPED_UNICODE);
