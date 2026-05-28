<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$doc = cromax_read_page_text_overrides();
$json = json_encode($doc, JSON_UNESCAPED_UNICODE);
echo $json === false ? '{}' : $json;
