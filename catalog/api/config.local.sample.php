<?php
/**
 * Скопируйте как config.local.php на сервере (рядом с bootstrap.php).
 * Хэш пароля: php -r "echo password_hash('ваш_пароль', PASSWORD_DEFAULT), PHP_EOL;"
 * Файл config.local.php не коммитьте.
 * Пошагово: см. INSTRUKTSIYA-POLZOVATELI.md в этой папке.
 *
 * Пользователи:
 * — Старый формат «логин => хеш» даёт доступ ко всем зонам: каталог, карта дилеров, тексты страниц.
 * — Расширенный формат: password + необязательный список can — только указанные зоны:
 *      catalog — карточки товаров (save-product)
 *      dealers — представители на карте «Где купить» (save-dealers)
 *      page_text — редактируемые блоки на страницах (save-page-text-overrides)
 */
declare(strict_types=1);

return [
    'users' => [
        // 'admin' => '$2y$10$...',

        /*
        'karta_only' => [
            'password' => '$2y$10$...',
            'can' => ['dealers'],
        ],
        'catalog_only' => [
            'password' => '$2y$10$...',
            'capabilities' => ['catalog'], // то же что can
        ],
        */
    ],
];
