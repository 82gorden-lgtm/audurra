# New Site Template

Шаблон очищен до нейтрального сайта New Site. Внутри сохранены шапка, подвал, каталог, поиск, форма обратной связи, карточки представителей, редактирование каталога и редактирование текстовых блоков.

## Быстрый старт

1. Скопируйте папку шаблона в папку нового сайта.
2. Замените `New Site`, `new-site.example`, логотипы в `img/new-site-logo.svg` и `img/template-brand.svg`.
3. Отредактируйте страницы `index.html`, `pages/about.html`, `pages/services.html`, `pages/text-page.html`, `contacts/contacts.html`.
4. Не меняйте верхнюю чёрную полосу: там остаётся логотип Axalta и ссылка `axalta.com`, как в исходном проекте.
5. В средней строке шапки сохраняйте структуру оригинала: поиск, «Мой New Site», ссылка на представителей и четыре иконки YouTube, Facebook, Instagram, RSS.
6. В футере сохраняйте оригинальный контактный блок Axalta Coating Systems и нижний логотип Axalta, как на исходном сайте.
7. Запустите сборку общих частей и поиска:

```powershell
node tools/site-chrome.mjs
node tools/build-search-index.mjs
```

Если в системе есть npm, можно использовать `npm run build`.

## Структура

- `templates/partials/` и `templates/assembly/` — общая шапка, меню и подвал.
- `tools/site-chrome.mjs` — вставляет шапку и подвал в HTML между маркерами `SITE_TEMPLATE`.
- `tools/build-search-index.mjs` — пересобирает `search-index.js`.
- `catalog/` — каталог, карточка товара, клиентские скрипты и PHP API редактирования.
- `contacts/` — страница формы и PHP API отправки писем.
- `who-we-are/where-to-buy.html` — карточки представителей и редактор представителей.
- `site-editor.js` — вход «Мой New Site», загрузка правок каталога, представителей и текстов.

## Каталог

Данные каталога лежат в `catalog/catalog-products-data.json` и `catalog/catalog-products-data.js`. Сейчас оставлен один товар `TEST-001`.

На главной странице каталога временно размещён блок с инструкцией по начальной настройке товаров. Удалите его из `catalog/index.html` после настройки каталога.

### Страницы групп каталога

Если товары нужно сгруппировать по признаку, используйте тип страницы `catalog/group-demo.html`. Это аналог страницы вроде «Легковые автомобили»: хлебные крошки, заголовок и сетка плиток, ведущих в каталог с параметрами фильтра.

Для нового сайта создавайте такие страницы под реальные признаки: сфера применения, тип клиента, направление продукта, регион или бренд. После добавления страницы внесите ссылку в меню/футер и пересоберите поиск.

Для нового сайта замените поля товара: `sku`, `articleRef`, `name`, `category`, `image`, `descriptionRu`, ссылки на TDS/SDS. После изменений пересоберите поиск.

Редактирование через сайт сохраняет правки в `catalog/api/data/product-overrides.json`. Для работы на сервере папка `catalog/api/data/` должна быть доступна PHP на запись.

## Текстовые страницы

Редактируемые блоки помечаются атрибутом `data-cromax-text-key`. Ключ должен быть уникальным, например `pages.about.title`. Правки сохраняются в `catalog/api/data/page-text-overrides.json`.

На главной странице временно размещён блок с инструкцией по настройке редактируемых текстов. Удалите его из `index.html` после настройки сайта.

### Типы внутренних страниц

В шаблоне есть два типа внутренних страниц:

- Страница с верхней картинкой между шапкой и хлебными крошками. Примеры: `pages/about.html` и `contacts/contacts.html`, блок `.template-page-hero`, изображение `img/page-hero-demo.svg`. Используйте такой тип для разделов, где нужен визуальный баннер.
- Обычная текстовая страница без верхней картинки. Пример: `pages/text-page.html`. Используйте такой тип для простых описательных страниц.

Если страница должна быть с картинкой, блок `.template-page-hero` ставится сразу после `<!-- SITE_TEMPLATE:END site-top -->` и перед `<main>` с хлебными крошками.


### Единое меню сайта

Верхнее меню хранится в `templates/partials/main-nav.html` и должно быть одинаковым на всех страницах после сборки. Если страница использует левое меню, оно берётся из `templates/partials/left-side-nav.html` через маркеры `<!-- SITE_TEMPLATE:BEGIN left-side-nav -->` / `<!-- SITE_TEMPLATE:END left-side-nav -->`.

По умолчанию верхнее и левое меню должны соответствовать друг другу так же, как в исходном проекте: одинаковые разделы, одинаковая вложенность, включая третий уровень. Исключения допустимы только если это прямо указано для конкретной страницы или раздела. После изменения любого меню выполните сборку и проверьте раскрытие пунктов в верхнем и левом меню.

### Страницы с левым меню

Для больших текстовых разделов используйте тип страницы `pages/side-menu-demo.html` и общий partial `templates/partials/left-side-nav.html`. Это аналог страниц вроде «Обучение»: слева находится меню раздела, справа основной текст. Левое меню должно соответствовать структуре основного меню с теми же исключениями, что и на исходном сайте: внешние ссылки и отсутствующие страницы можно не выводить. Если в верхнем меню есть третий уровень, он должен быть отражён и в левом меню.

При изменении основного меню проверьте страницы с левым меню вручную: текущий пункт должен иметь `aria-current="page"` и класс `facet-leaf-link--current`. Для раскрывающихся пунктов используйте существующие классы оригинального проекта: `submenu-entry`, `third-menu-panel` в верхнем меню и `facet-block--nested`, `facet-sublist--deep` в левом меню; не заменяйте их новой стилизацией.

## Представители

Страница `who-we-are/where-to-buy.html` использует карту и файл `catalog/api/data/dealers-ru.json`. В шаблоне есть один тестовый представитель. Пользователь с правом `dealers` может менять карточки через сайт.

Важно: на сервере файл `catalog/api/data/dealers-ru.json` должен существовать и содержать минимум одного представителя, иначе карта/редактор представителей могут работать некорректно.

## Пользователи

Скопируйте `catalog/api/config.local.sample.php` в `catalog/api/config.local.php` только на сервере. Создайте хеш пароля:

```powershell
php -r "echo password_hash('ваш_пароль', PASSWORD_DEFAULT), PHP_EOL;"
```

В `config.local.php` добавьте пользователя и права: `catalog`, `dealers`, `page_text`.

## Форма обратной связи

Скопируйте `contacts/api/config.local.sample.php` в `contacts/api/config.local.php` только на сервере. Укажите SMTP, получателей, `from_email`, `from_name` и секрет Yandex Smart Captcha. Публичный ключ капчи задаётся в `contacts/contacts.html` в `data-sitekey` у `#contactSmartcaptcha`.

## Деплой Beget

Workflow находится в `.github/workflows/deploy-beget.yml`. Задайте secrets `BEGET_FTP_HOST`, `BEGET_FTP_USER`, `BEGET_FTP_PASSWORD`. Если FTP-пользователь Beget уже открывается в веб-корне домена (`../audurra.ru/public_html`), в workflow должен быть `server-dir: ./`, иначе получится вложенный путь `audurra.ru/public_html/audurra.ru/public_html`.

После первого деплоя вручную загрузите на сервер реальные `config.local.php` для каталога и контактов. Не храните пароли и SMTP-секреты в репозитории.

## Файлы, которые создаются только на сервере

Эти файлы не хранятся в git и не должны попадать в автоматический деплой. Они содержат пароли, SMTP-доступы, секреты капчи или рабочие правки пользователей.

### `catalog/api/config.local.php`

Создаётся вручную на сервере рядом с `catalog/api/bootstrap.php`. Основа файла — `catalog/api/config.local.sample.php`.

В этом файле задаются пользователи для входа «Мой New Site»:

```php
<?php
declare(strict_types=1);

return [
    'users' => [
        'admin' => [
            'password' => '$2y$10$...', // password_hash
            'can' => ['catalog', 'dealers', 'page_text'],
        ],
    ],
];
```

Права:

- `catalog` — редактирование карточек товаров.
- `dealers` — редактирование представителей.
- `page_text` — редактирование текстовых блоков страниц.

### `contacts/api/config.local.php`

Создаётся вручную на сервере рядом с `contacts/api/submit.php`. Основа файла — `contacts/api/config.local.sample.php`.

В этом файле задаются SMTP, получатели формы и серверный ключ Yandex Smart Captcha:

```php
<?php
declare(strict_types=1);

return [
    'smtp_host' => 'smtp.example.com',
    'smtp_port' => 587,
    'smtp_user' => 'noreply@example.com',
    'smtp_pass' => 'пароль_приложения',
    'smtp_secure' => 'tls',
    'from_email' => 'noreply@example.com',
    'from_name' => 'New Site сайт',
    'recipients' => [
        'inbox@example.com',
    ],
    'contact_max_per_window' => 5,
    'contact_window_minutes' => 15,
    'smartcaptcha_server_key' => 'секретный_ключ_капчи',
];
```

Публичный ключ капчи указывается отдельно в `contacts/contacts.html` в атрибуте `data-sitekey` у блока `#contactSmartcaptcha`.

### `catalog/api/data/`

Папка должна существовать на сервере и быть доступна PHP на запись. Обычно достаточно прав `755`, но на некоторых хостингах может потребоваться `775`.

Внутри PHP будет создавать или обновлять рабочие файлы:

- `catalog/api/data/product-overrides.json` — правки карточек товаров.
- `catalog/api/data/page-text-overrides.json` — правки текстовых блоков страниц.
- `catalog/api/data/dealers-ru.json` — карточки представителей. Файл должен существовать на сервере и содержать минимум одну карточку представителя.
- `catalog/api/data/audit.log` — журнал действий редакторов, если включена запись аудита.

В шаблоне `dealers-ru.json` уже есть тестовый представитель. Если на сервере этот файл изменяется через сайт, не перезаписывайте его деплоем без необходимости.

### `contacts/api/data/`

Папка нужна для служебного состояния формы обратной связи и должна быть доступна PHP на запись.

PHP может создать файл:

- `contacts/api/data/rate_state.json` — состояние ограничения частоты отправки формы.

### Что проверить на сервере

- `catalog/api/config.local.php` и `contacts/api/config.local.php` существуют только на сервере.
- В обоих файлах нет синтаксических ошибок PHP.
- `catalog/api/data/` и `contacts/api/data/` доступны PHP на запись.
- Реальные пароли, SMTP-доступы и ключи капчи не добавлены в git.
- После деплоя вход «Мой New Site», сохранение товара, сохранение представителей и отправка формы работают на реальном домене.

## Проверка перед публикацией

- Откройте `index.html`, `catalog/index.html`, `catalog/product.html?sku=TEST-001`, `search.html`, `contacts/contacts.html`, `who-we-are/where-to-buy.html`.
- Проверьте, что `node tools/build-search-index.mjs` обновляет `search-index.js`.
- Проверьте, что деплой идёт прямо в веб-корень домена, без вложенной папки `audurra.ru/public_html/audurra.ru/public_html` (см. `.github/workflows/deploy-beget.yml`).
- Проверьте, что реальные `config.local.php` не попали в репозиторий.
