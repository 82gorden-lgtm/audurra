<?php
/**
 * Скопируйте в config.local.php (рядом с submit.php) на сервере.
 * Не коммитить config.local.php.
 * Краткий чеклист полей: ../KONTAKT-FORMA-INSTRUKTSIYA.txt (раздел «Установка почты…»).
 */
declare(strict_types=1);

return [
    // SMTP (пример порта: 465 + ssl, или 587 + tls)
    'smtp_host' => 'smtp.example.com',
    'smtp_port' => 587,
    'smtp_user' => 'noreply@example.com',
    'smtp_pass' => 'секрет_или_пароль_приложения',
    'smtp_secure' => 'tls', // 'ssl' | 'tls' | ''
    'from_email' => 'noreply@example.com',
    'from_name' => 'New Site сайт',

    // Все адреса в поле «Кому» (To); Bcc/Cc не используется
    'recipients' => [
        'inbox1@example.com',
        'inbox2@example.com',
    ],

    // Не больше стольких писем с одного IP за окно (ниже)
    'contact_max_per_window' => 5,
    'contact_window_minutes' => 15,

    // Yandex Smart Captcha: серверный ключ (секрет) из той же капчи, что и клиентский data-sitekey
    'smartcaptcha_server_key' => '',
];
