<?php
/**
 * Общая инициализация API «Мой New Site»: сессия и загрузка учётных данных.
 * Учётки задаются в config.local.php (не коммитить) — см. config.local.sample.php
 */

declare(strict_types=1);

header('X-Content-Type-Options: nosniff');

$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443);

if (session_status() !== PHP_SESSION_ACTIVE) {
    // Массив параметров с SameSite поддерживается только с PHP 7.3; на 7.2 это давало фатал и пустой ответ 500 у login.php.
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    } else {
        session_set_cookie_params(0, '/', '', $secure, true);
    }
    session_start();
}

/**
 * Идентификаторы зон редактирования для API «Мой New Site».
 *
 * @return list<string>
 */
function cromax_editor_capability_ids(): array
{
    return ['catalog', 'dealers', 'page_text'];
}

/**
 * @param array<mixed> $list
 * @return list<string>
 */
function cromax_normalize_capabilities_list(array $list): array
{
    $allowed = array_flip(cromax_editor_capability_ids());
    $seen = [];
    foreach ($list as $item) {
        if (!is_string($item)) {
            continue;
        }
        $k = trim($item);
        if ($k === '' || !isset($allowed[$k])) {
            continue;
        }
        $seen[$k] = true;
    }

    return array_keys($seen);
}

/**
 * Учётки из config.local.php: строка-хеш (полный доступ) или массив с password и can/capabilities.
 *
 * @return array<string, array{password: string, capabilities: list<string>}>
 */
function cromax_load_user_accounts(): array
{
    $local = __DIR__ . '/config.local.php';
    if (!is_readable($local)) {
        return [];
    }
    /** @var mixed $data */
    $data = require $local;
    if (!is_array($data) || !isset($data['users']) || !is_array($data['users'])) {
        return [];
    }
    $all = cromax_editor_capability_ids();
    $out = [];
    foreach ($data['users'] as $login => $entry) {
        $login = is_string($login) ? trim($login) : '';
        if ($login === '') {
            continue;
        }
        if (is_string($entry)) {
            $hash = trim($entry);
            if ($hash === '') {
                continue;
            }
            $out[$login] = [
                'password' => $hash,
                'capabilities' => $all,
            ];

            continue;
        }
        if (!is_array($entry)) {
            continue;
        }
        $hash = isset($entry['password']) && is_string($entry['password']) ? trim($entry['password']) : '';
        if ($hash === '') {
            continue;
        }
        $hasExplicitCan = array_key_exists('can', $entry) || array_key_exists('capabilities', $entry);
        if (array_key_exists('can', $entry)) {
            $canList = $entry['can'];
        } elseif (array_key_exists('capabilities', $entry)) {
            $canList = $entry['capabilities'];
        } else {
            $canList = null;
        }
        if (!$hasExplicitCan) {
            $caps = $all;
        } elseif (!is_array($canList)) {
            // Некорректный тип списка — не даём прав (безопаснее, чем полный доступ).
            $caps = [];
        } else {
            $caps = cromax_normalize_capabilities_list($canList);
        }
        $out[$login] = [
            'password' => $hash,
            'capabilities' => $caps,
        ];
    }

    return $out;
}

/**
 * @return list<string>
 */
function cromax_current_editor_capabilities(): array
{
    $login = $_SESSION['cromax_editor'] ?? null;
    if (!is_string($login) || trim($login) === '') {
        return [];
    }
    $accounts = cromax_load_user_accounts();
    $trim = trim($login);
    if (!isset($accounts[$trim])) {
        return [];
    }

    return $accounts[$trim]['capabilities'];
}

function cromax_user_has_capability(string $capability): bool
{
    return in_array($capability, cromax_current_editor_capabilities(), true);
}

function cromax_require_editor(): void
{
    if (empty($_SESSION['cromax_editor']) || !is_string($_SESSION['cromax_editor'])) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'unauthorized'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

function cromax_require_capability(string $capability): void
{
    cromax_require_editor();
    $allowedCaps = array_flip(cromax_editor_capability_ids());
    if (!isset($allowedCaps[$capability])) {
        cromax_write_audit_log('capability_denied', ['reason' => 'unknown_capability', 'capability' => $capability]);
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'server_misconfigured'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!cromax_user_has_capability($capability)) {
        cromax_write_audit_log('capability_denied', [
            'reason' => 'forbidden_capability',
            'capability' => $capability,
            'user' => $_SESSION['cromax_editor'],
        ]);
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'forbidden_capability'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

function cromax_request_header(string $name): string
{
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    $value = $_SERVER[$key] ?? '';
    return is_string($value) ? trim($value) : '';
}

function cromax_session_csrf_token(bool $rotate = false): string
{
    $current = $_SESSION['cromax_csrf_token'] ?? null;
    if (!$rotate && is_string($current) && preg_match('/^[a-f0-9]{64}$/', $current) === 1) {
        return $current;
    }
    try {
        $token = bin2hex(random_bytes(32));
    } catch (Throwable $e) {
        $token = hash('sha256', uniqid('cromax-csrf', true));
    }
    $_SESSION['cromax_csrf_token'] = $token;
    return $token;
}

function cromax_current_origin(): string
{
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (!is_string($host) || trim($host) === '') {
        return '';
    }
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $scheme . '://' . trim($host);
}

function cromax_origin_from_url(string $url): string
{
    $parts = parse_url($url);
    if (!is_array($parts)) {
        return '';
    }
    $scheme = isset($parts['scheme']) && is_string($parts['scheme']) ? strtolower($parts['scheme']) : '';
    $host = isset($parts['host']) && is_string($parts['host']) ? $parts['host'] : '';
    if ($scheme === '' || $host === '') {
        return '';
    }
    $port = isset($parts['port']) ? (int) $parts['port'] : null;
    $origin = $scheme . '://' . $host;
    if ($port !== null) {
        $isDefault = ($scheme === 'https' && $port === 443) || ($scheme === 'http' && $port === 80);
        if (!$isDefault) {
            $origin .= ':' . $port;
        }
    }
    return $origin;
}

function cromax_request_origin_matches_host(): bool
{
    $expected = cromax_current_origin();
    if ($expected === '') {
        return false;
    }
    $origin = cromax_request_header('Origin');
    if ($origin !== '') {
        return hash_equals($expected, cromax_origin_from_url($origin));
    }
    $referer = cromax_request_header('Referer');
    if ($referer !== '') {
        return hash_equals($expected, cromax_origin_from_url($referer));
    }
    return true;
}

function cromax_client_ip(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!is_string($ip) || trim($ip) === '') {
        return '0.0.0.0';
    }
    $ip = trim($ip);
    return strlen($ip) > 64 ? substr($ip, 0, 64) : $ip;
}

function cromax_audit_log_path(): string
{
    return __DIR__ . '/data/security-audit.log';
}

/**
 * @param array<string, mixed> $details
 */
function cromax_write_audit_log(string $action, array $details = []): void
{
    $path = cromax_audit_log_path();
    $dir = dirname($path);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
        if (!is_dir($dir)) {
            return;
        }
    }
    $record = [
        'ts' => gmdate('c'),
        'action' => $action,
        'user' => isset($_SESSION['cromax_editor']) && is_string($_SESSION['cromax_editor']) ? $_SESSION['cromax_editor'] : null,
        'ip' => cromax_client_ip(),
        'ua' => isset($_SERVER['HTTP_USER_AGENT']) && is_string($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 300) : '',
        'details' => $details,
    ];
    $json = json_encode($record, JSON_UNESCAPED_UNICODE);
    if (!is_string($json)) {
        return;
    }
    // Без @ предупреждения PHP ломают JSON у login.php и клиент показывает «ошибка сети».
    @file_put_contents($path, $json . PHP_EOL, FILE_APPEND | LOCK_EX);
}

/**
 * @return array{allowed: bool, retry_after: int}
 */
function cromax_rate_limit_check(string $scope, int $maxAttempts, int $windowSeconds): array
{
    $maxAttempts = max(1, $maxAttempts);
    $windowSeconds = max(1, $windowSeconds);
    $dir = __DIR__ . '/data/rate-limit';
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true) && !is_dir($dir)) {
            return ['allowed' => true, 'retry_after' => 0];
        }
    }

    $keyScope = preg_replace('/[^a-z0-9_-]/i', '_', strtolower($scope)) ?: 'default';
    $file = $dir . '/' . $keyScope . '-' . sha1(cromax_client_ip()) . '.json';
    $now = time();
    $stamps = [];
    if (is_readable($file)) {
        $raw = file_get_contents($file);
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                foreach ($decoded as $t) {
                    if (is_int($t)) {
                        $stamps[] = $t;
                    }
                }
            }
        }
    }
    $limitStart = $now - $windowSeconds;
    $stamps = array_values(array_filter($stamps, static function ($t) use ($limitStart) {
        return is_int($t) && $t >= $limitStart;
    }));

    if (count($stamps) >= $maxAttempts) {
        sort($stamps);
        $oldest = (int) $stamps[0];
        $retryAfter = max(1, ($oldest + $windowSeconds) - $now);
        return ['allowed' => false, 'retry_after' => $retryAfter];
    }

    $stamps[] = $now;
    file_put_contents($file, json_encode($stamps), LOCK_EX);
    return ['allowed' => true, 'retry_after' => 0];
}

function cromax_overrides_path(): string
{
    return __DIR__ . '/data/product-overrides.json';
}

/**
 * @return array<string, array<string, mixed>>
 */
function cromax_read_overrides(): array
{
    $path = cromax_overrides_path();
    if (!is_readable($path)) {
        return [];
    }
    $raw = file_get_contents($path);
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * @param array<string, array<string, mixed>> $data
 */
function cromax_write_overrides(array $data): bool
{
    $path = cromax_overrides_path();
    $dir = dirname($path);
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true) && !is_dir($dir)) {
            return false;
        }
    }
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) {
        return false;
    }
    return file_put_contents($path, $json, LOCK_EX) !== false;
}

/**
 * @param array<int, mixed> $raw
 * @return array<int, array{title: string, rows: array<int, array{label: string, value: string}>}>
 */
function cromax_normalize_characteristic_groups(array $raw): array
{
    $groups = [];
    foreach ($raw as $g) {
        if (!is_array($g)) {
            continue;
        }
        $title = isset($g['title']) && is_string($g['title']) ? trim($g['title']) : '';
        $rows = [];
        if (isset($g['rows']) && is_array($g['rows'])) {
            foreach ($g['rows'] as $r) {
                if (!is_array($r)) {
                    continue;
                }
                $label = isset($r['label']) && is_string($r['label']) ? trim($r['label']) : '';
                $value = isset($r['value']) && is_string($r['value']) ? trim($r['value']) : '';
                if ($label === '' && $value === '') {
                    continue;
                }
                $rows[] = ['label' => $label, 'value' => $value];
            }
        }
        if ($title === '' && $rows === []) {
            continue;
        }
        $groups[] = ['title' => $title, 'rows' => $rows];
    }
    return $groups;
}

/**
 * Варианты исполнения: variant, articleRef, materialCode (как в EU-данных каталога).
 *
 * @param array<int, mixed> $raw
 * @return array<int, array{variant: string, articleRef: string, materialCode: string}>
 */
function cromax_normalize_variants(array $raw): array
{
    $out = [];
    foreach ($raw as $item) {
        if (!is_array($item)) {
            continue;
        }
        $v = trim((string) ($item['variant'] ?? ''));
        $ar = trim((string) ($item['articleRef'] ?? ''));
        $mc = trim((string) ($item['materialCode'] ?? ''));
        if ($v === '' && $ar === '' && $mc === '') {
            continue;
        }
        $out[] = [
            'variant' => $v,
            'articleRef' => $ar,
            'materialCode' => $mc,
        ];
    }
    return $out;
}

/**
 * @param array<string, mixed> $patch
 * @return array<string, mixed>
 */
function cromax_merge_product_patch(array $existing, array $patch): array
{
    $out = $existing;
    foreach ($patch as $key => $val) {
        if ($key === 'descriptionRu') {
            if (!is_array($val)) {
                continue;
            }
            $baseRu = isset($out['descriptionRu']) && is_array($out['descriptionRu']) ? $out['descriptionRu'] : [];
            $merged = $baseRu;
            if (array_key_exists('intro', $val)) {
                $merged['intro'] = is_string($val['intro']) ? $val['intro'] : '';
            }
            if (array_key_exists('bullets', $val) && is_array($val['bullets'])) {
                $merged['bullets'] = array_values(array_filter(array_map(static function ($b) {
                    return is_string($b) ? trim($b) : '';
                }, $val['bullets']), static function ($b) {
                    return $b !== '';
                }));
            }
            if (array_key_exists('variants', $val) && is_array($val['variants'])) {
                $merged['variants'] = cromax_normalize_variants($val['variants']);
            }
            if (array_key_exists('characteristicGroups', $val) && is_array($val['characteristicGroups'])) {
                $merged['characteristicGroups'] = cromax_normalize_characteristic_groups($val['characteristicGroups']);
            }
            $out['descriptionRu'] = $merged;
            continue;
        }
        if (in_array($key, ['name', 'image', 'technicalDataSheetUrl', 'safetyDataSheetUrl', 'productPageUrl'], true)) {
            if ($val === null) {
                unset($out[$key]);
                continue;
            }
            if (is_string($val)) {
                $out[$key] = trim($val);
            }
        }
    }
    return $out;
}

function cromax_dealers_path(): string
{
    return __DIR__ . '/data/dealers-ru.json';
}

/**
 * @param array<mixed>|null $doc
 * @return array{version:int, byRegionId:array<string, array<int, array<string, mixed>>>}
 */
function cromax_normalize_dealers_document(?array $doc): array
{
    $out = [
        'version' => 1,
        'byRegionId' => [],
    ];
    if (!is_array($doc)) {
        return $out;
    }
    if (isset($doc['version']) && is_int($doc['version'])) {
        $out['version'] = $doc['version'];
    }
    $by = isset($doc['byRegionId']) && is_array($doc['byRegionId']) ? $doc['byRegionId'] : [];
    foreach ($by as $regionKey => $list) {
        if ((!is_string($regionKey) && !is_int($regionKey)) || !is_array($list)) {
            continue;
        }
        $regionKeyTrim = trim((string) $regionKey);
        if ($regionKeyTrim === '') {
            continue;
        }
        $normList = [];
        foreach ($list as $row) {
            if (!is_array($row)) {
                continue;
            }
            $sale = isset($row['saleType']) && is_string($row['saleType']) ? trim($row['saleType']) : '';
            if (!in_array($sale, ['wholesale', 'retail', 'wholesale_retail'], true)) {
                $sale = 'retail';
            }
            $company = isset($row['company']) && is_string($row['company']) ? trim($row['company']) : '';
            $address = isset($row['address']) && is_string($row['address']) ? trim($row['address']) : '';
            $email = isset($row['email']) && is_string($row['email']) ? trim($row['email']) : '';
            $website = isset($row['website']) && is_string($row['website']) ? trim($row['website']) : '';
            $phones = [];
            if (isset($row['phones']) && is_array($row['phones'])) {
                foreach ($row['phones'] as $ph) {
                    if (!is_string($ph)) {
                        continue;
                    }
                    $t = trim($ph);
                    if ($t !== '') {
                        $phones[] = $t;
                    }
                }
            }
            if ($company === '' && $address === '' && $phones === [] && $email === '' && $website === '') {
                continue;
            }
            $normList[] = [
                'saleType' => $sale,
                'company' => $company,
                'address' => $address,
                'phones' => $phones,
                'email' => $email,
                'website' => $website,
            ];
        }
        if ($normList !== []) {
            $out['byRegionId'][$regionKeyTrim] = array_values($normList);
        }
    }

    return $out;
}

/**
 * @return array{version:int, byRegionId:array<string, array<int, array<string, mixed>>>}
 */
function cromax_read_dealers(): array
{
    $path = cromax_dealers_path();
    if (!is_readable($path)) {
        return cromax_normalize_dealers_document(null);
    }
    $raw = file_get_contents($path);
    if ($raw === false || $raw === '') {
        return cromax_normalize_dealers_document(null);
    }
    /** @var mixed $decoded */
    $decoded = json_decode($raw, true);

    return cromax_normalize_dealers_document(is_array($decoded) ? $decoded : null);
}

/**
 * @param array<mixed> $doc
 */
function cromax_write_dealers(array $doc): bool
{
    $path = cromax_dealers_path();
    $dir = dirname($path);
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true) && !is_dir($dir)) {
            return false;
        }
    }
    $norm = cromax_normalize_dealers_document($doc);
    $json = json_encode($norm, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    return $json !== false && file_put_contents($path, $json, LOCK_EX) !== false;
}

/** Максимальная длина одного текстового блока (байты UTF-8). */
function cromax_page_text_max_block_bytes(): int
{
    return 50000;
}

function cromax_page_text_overrides_path(): string
{
    return __DIR__ . '/data/page-text-overrides.json';
}

/**
 * Допустимый ключ блока: латиница, цифры, точка, подчёркивание, двоеточие, дефис.
 */
function cromax_normalize_page_text_key(mixed $key): ?string
{
    if (!is_string($key)) {
        return null;
    }
    $k = trim($key);
    if ($k === '' || strlen($k) > 120) {
        return null;
    }
    if (preg_match('/^[a-zA-Z0-9_.:\\-]+$/', $k) !== 1) {
        return null;
    }

    return $k;
}

/**
 * @param array<mixed>|null $doc
 * @return array{version:int, blocks:array<string, string>}
 */
function cromax_normalize_page_text_document(?array $doc): array
{
    $out = [
        'version' => 1,
        'blocks' => [],
    ];
    if (!is_array($doc)) {
        return $out;
    }
    if (isset($doc['version']) && is_int($doc['version'])) {
        $out['version'] = $doc['version'];
    }
    $blocks = isset($doc['blocks']) && is_array($doc['blocks']) ? $doc['blocks'] : [];
    $maxBytes = cromax_page_text_max_block_bytes();
    foreach ($blocks as $k => $val) {
        $nk = cromax_normalize_page_text_key((string) $k);
        if ($nk === null || !is_string($val)) {
            continue;
        }
        $text = trim($val);
        if ($text === '') {
            continue;
        }
        if (strlen($text) > $maxBytes) {
            $text = substr($text, 0, $maxBytes);
        }
        $out['blocks'][$nk] = $text;
    }

    return $out;
}

/**
 * @return array{version:int, blocks:array<string, string>}
 */
function cromax_read_page_text_overrides(): array
{
    $path = cromax_page_text_overrides_path();
    if (!is_readable($path)) {
        return cromax_normalize_page_text_document(null);
    }
    $raw = file_get_contents($path);
    if ($raw === false || $raw === '') {
        return cromax_normalize_page_text_document(null);
    }
    /** @var mixed $decoded */
    $decoded = json_decode($raw, true);

    return cromax_normalize_page_text_document(is_array($decoded) ? $decoded : null);
}

/**
 * @param array{version:int, blocks:array<string, string>} $doc
 */
function cromax_write_page_text_overrides(array $doc): bool
{
    $path = cromax_page_text_overrides_path();
    $dir = dirname($path);
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true) && !is_dir($dir)) {
            return false;
        }
    }
    $norm = cromax_normalize_page_text_document($doc);
    $json = json_encode($norm, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    return $json !== false && file_put_contents($path, $json, LOCK_EX) !== false;
}

/**
 * Влить patch в документ. Пустая строка в patch удаляет ключ (откат к HTML из репозитория).
 *
 * @param array<string, mixed> $patch
 * @return array{ok:bool, error?:string, doc?:array{version:int, blocks:array<string, string>}}
 */
function cromax_merge_page_text_patch(array $doc, array $patch): array
{
    $norm = cromax_normalize_page_text_document($doc);
    $maxBytes = cromax_page_text_max_block_bytes();
    foreach ($patch as $k => $val) {
        $nk = cromax_normalize_page_text_key((string) $k);
        if ($nk === null) {
            continue;
        }
        if ($val === null) {
            unset($norm['blocks'][$nk]);
            continue;
        }
        if (!is_string($val)) {
            return ['ok' => false, 'error' => 'invalid_patch_value'];
        }
        $text = trim($val);
        if ($text === '') {
            unset($norm['blocks'][$nk]);
            continue;
        }
        if (strlen($text) > $maxBytes) {
            return ['ok' => false, 'error' => 'text_too_long'];
        }
        $norm['blocks'][$nk] = $text;
    }

    return ['ok' => true, 'doc' => $norm];
}
