<?php
/**
 * POST JSON: { firstName, lastName, company, city, phone, email, comment, companyWebsite?, captchaToken? }
 * Ответ: { "ok": true } или { "ok": false, "error": "код" }
 */
declare(strict_types=1);

header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/phpmailer/src/Exception.php';
require_once __DIR__ . '/phpmailer/src/PHPMailer.php';
require_once __DIR__ . '/phpmailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'method'], JSON_UNESCAPED_UNICODE);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$maxRequestBytes = 8192;
$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
if ($contentLength > $maxRequestBytes) {
    http_response_code(413);
    echo json_encode(['ok' => false, 'error' => 'too_large'], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input') ?: '';
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'json'], JSON_UNESCAPED_UNICODE);
    exit;
}

$hp = trim((string) ($data['companyWebsite'] ?? ''));
if ($hp !== '') {
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

$first = cromax_contact_trim((string) ($data['firstName'] ?? ''), 40);
$last = cromax_contact_trim((string) ($data['lastName'] ?? ''), 40);
$company = cromax_contact_trim((string) ($data['company'] ?? ''), 40);
$city = cromax_contact_trim((string) ($data['city'] ?? ''), 40);
$phone = cromax_contact_strip_crlf(cromax_contact_trim((string) ($data['phone'] ?? ''), 40));
$email = cromax_contact_strip_crlf(cromax_contact_trim((string) ($data['email'] ?? ''), 40));
$commentRaw = cromax_contact_trim((string) ($data['comment'] ?? ''), 1000);
$comment = str_replace("\r", '', $commentRaw);

if ($first === '' || $company === '' || $phone === '' || $email === '' || $comment === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'required'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'email'], JSON_UNESCAPED_UNICODE);
    exit;
}

$configPath = __DIR__ . '/config.local.php';
if (!is_readable($configPath)) {
    error_log('contacts/api: config.local.php missing');
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'server_config'], JSON_UNESCAPED_UNICODE);
    exit;
}
/** @var array<string, mixed> $config */
$config = require $configPath;

$recipients = $config['recipients'] ?? null;
if (!is_array($recipients) || $recipients === []) {
    error_log('contacts/api: no recipients in config');
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'server_config'], JSON_UNESCAPED_UNICODE);
    exit;
}
$emails = [];
foreach ($recipients as $r) {
    if (is_string($r) && filter_var(trim($r), FILTER_VALIDATE_EMAIL)) {
        $emails[] = trim($r);
    }
}
if ($emails === []) {
    error_log('contacts/api: no valid recipient emails');
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'server_config'], JSON_UNESCAPED_UNICODE);
    exit;
}

$ip = cromax_contact_client_ip();
$captchaSecret = trim((string) ($config['smartcaptcha_server_key'] ?? ''));
$captchaToken = cromax_contact_strip_crlf(cromax_contact_trim((string) ($data['captchaToken'] ?? ''), 2000));
if ($captchaSecret === '') {
    error_log('contacts/api: smartcaptcha_server_key empty in config');
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'server_config'], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($captchaToken === '' || !cromax_contact_verify_smartcaptcha($captchaSecret, $captchaToken, $ip)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'captcha'], JSON_UNESCAPED_UNICODE);
    exit;
}

$max = (int) ($config['contact_max_per_window'] ?? 5);
$winMin = (int) ($config['contact_window_minutes'] ?? 15);
if ($max < 1) {
    $max = 5;
}
if ($winMin < 1) {
    $winMin = 15;
}
$rateState = cromax_contact_rate_check($ip, $max, $winMin);
if ($rateState === 'unavailable') {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'temporary'], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($rateState !== 'allow') {
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => 'rate'], JSON_UNESCAPED_UNICODE);
    exit;
}

$body = cromax_contact_build_body(
    $first,
    $last,
    $company,
    $city,
    $phone,
    $email,
    $comment
);

$subject = 'Заявка с сайта New Site — ' . date('Y-m-d H:i');

$ok = cromax_contact_send_smtp(
    $config,
    $emails,
    $email,
    $subject,
    $body
);
if (!$ok) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'send'], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(200);
echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);

// --- helpers -----------------------------------------------------------------

/**
 * @param array<string, mixed> $config
 * @param array<int, string>   $toAll
 */
function cromax_contact_send_smtp(
    array $config,
    array $toAll,
    string $replyTo,
    string $subject,
    string $body
): bool {
    $host = (string) ($config['smtp_host'] ?? '');
    $port = (int) ($config['smtp_port'] ?? 587);
    $user = (string) ($config['smtp_user'] ?? '');
    $pass = (string) ($config['smtp_pass'] ?? '');
    $secure = (string) ($config['smtp_secure'] ?? 'tls');
    $fromEmail = (string) ($config['from_email'] ?? '');
    $fromName = (string) ($config['from_name'] ?? '');

    if ($host === '' || $fromEmail === '' || $toAll === []) {
        return false;
    }

    $mail = new PHPMailer(true);
    try {
        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->isSMTP();
        $mail->Host = $host;
        $mail->Port = $port;
        if ($user !== '' || $pass !== '') {
            $mail->SMTPAuth = true;
            $mail->Username = $user;
            $mail->Password = $pass;
        } else {
            $mail->SMTPAuth = false;
        }
        if ($secure === 'ssl') {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        } elseif ($secure === 'tls') {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        } else {
            $mail->SMTPSecure = '';
        }

        $mail->setFrom($fromEmail, $fromName);
        foreach ($toAll as $addr) {
            $mail->addAddress($addr);
        }
        $mail->addReplyTo($replyTo);
        $mail->Subject = $subject;
        $mail->isHTML(false);
        $mail->Body = $body;
        $mail->send();
        return true;
    } catch (PHPMailerException $e) {
        error_log('contacts/api PHPMailer: ' . $e->getMessage());
        return false;
    } catch (Throwable $e) {
        error_log('contacts/api: ' . $e->getMessage());
        return false;
    }
}

function cromax_contact_build_body(
    string $first,
    string $last,
    string $company,
    string $city,
    string $phone,
    string $email,
    string $comment
): string {
    $lines = [
        'Контактная форма',
        '---',
        'Имя: ' . $first,
        'Фамилия: ' . $last,
        'Компания: ' . $company,
        'Город: ' . $city,
        'Телефон: ' . $phone,
        'E-mail: ' . $email,
        '---',
        'Комментарий:',
        $comment,
    ];
    return implode("\n", $lines);
}

function cromax_contact_client_ip(): string
{
    $v = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    if (filter_var($v, FILTER_VALIDATE_IP) !== false) {
        return $v;
    }
    return '0.0.0.0';
}

function cromax_contact_trim(string $s, int $max): string
{
    $s = trim($s);
    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        if (mb_strlen($s, 'UTF-8') > $max) {
            $s = mb_substr($s, 0, $max, 'UTF-8');
        }
        return $s;
    }
    if (strlen($s) > $max) {
        $s = substr($s, 0, $max);
    }
    return $s;
}

function cromax_contact_strip_crlf(string $s): string
{
    $s = str_replace(["\r", "\n"], ' ', $s);
    $s = preg_replace('/[[:cntrl:]]+/', '', $s) ?? $s;
    return trim($s);
}

function cromax_contact_verify_smartcaptcha(string $secret, string $token, string $ip): bool
{
    if ($token === '' || $secret === '') {
        return false;
    }
    $body = http_build_query(
        [
            'secret' => $secret,
            'token' => $token,
            'ip' => $ip,
        ],
        '',
        '&',
        PHP_QUERY_RFC3986
    );
    $url = 'https://smartcaptcha.cloud.yandex.ru/validate';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        if ($ch === false) {
            return false;
        }
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt(
            $ch,
            CURLOPT_HTTPHEADER,
            ['Content-Type: application/x-www-form-urlencoded; charset=UTF-8']
        );
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $raw = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($raw === false || $code < 200 || $code >= 300) {
            return false;
        }
    } else {
        $ctx = stream_context_create(
            [
                'http' => [
                    'method' => 'POST',
                    'header' => "Content-Type: application/x-www-form-urlencoded; charset=UTF-8\r\n",
                    'content' => $body,
                    'timeout' => 10.0,
                ],
            ]
        );
        $raw = @file_get_contents($url, false, $ctx);
        if (!is_string($raw) || $raw === '') {
            return false;
        }
    }
    $json = json_decode($raw, true);
    if (!is_array($json) || !isset($json['status'])) {
        return false;
    }
    return (string) ($json['status'] ?? '') === 'ok';
}

/**
 * @return 'allow'|'rate'|'unavailable'
 */
function cromax_contact_rate_check(string $ip, int $max, int $windowMinutes): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true) && !is_dir($dir)) {
            error_log('contacts/api: cannot create data/');
            return 'unavailable';
        }
    }
    $path = $dir . '/rate_state.json';
    $windowSec = $windowMinutes * 60;
    $now = time();

    $fp = fopen($path, 'c+');
    if ($fp === false) {
        error_log('contacts/api: cannot open rate state file');
        return 'unavailable';
    }
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        error_log('contacts/api: cannot lock rate state file');
        return 'unavailable';
    }

    $raw = stream_get_contents($fp);
    $state = (is_string($raw) && $raw !== '') ? json_decode($raw, true) : null;
    if (!is_array($state)) {
        $state = [];
    }

    $e = $state[$ip] ?? null;
    if (!is_array($e) || !isset($e['s'], $e['n']) || !is_int($e['s']) || !is_int($e['n'])) {
        $e = ['s' => $now, 'n' => 0];
    } elseif ($now - $e['s'] > $windowSec) {
        $e = ['s' => $now, 'n' => 0];
    }

    $e['n']++;
    if ($e['n'] > $max) {
        $state[$ip] = $e;
        cromax_contact_rate_write($fp, $state);
        flock($fp, LOCK_UN);
        fclose($fp);
        return 'rate';
    }

    $state[$ip] = $e;
    cromax_contact_rate_write($fp, $state);
    flock($fp, LOCK_UN);
    fclose($fp);
    return 'allow';
}

/**
 * @param resource $fp
 * @param array<string, mixed> $state
 */
function cromax_contact_rate_write($fp, array $state): void
{
    ftruncate($fp, 0);
    rewind($fp);
    $json = json_encode($state, JSON_UNESCAPED_UNICODE);
    if ($json !== false) {
        fwrite($fp, $json);
    }
}
