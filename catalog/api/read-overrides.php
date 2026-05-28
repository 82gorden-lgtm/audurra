<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

$path = __DIR__ . '/data/product-overrides.json';
if (!is_readable($path)) {
    echo '{}';
    exit;
}

readfile($path);
