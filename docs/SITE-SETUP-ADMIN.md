# Настройка продакшен-сайта Audurra

Документ для администратора сервера. Корень сайта — каталог, в который развёрнут проект (`project_root`).

## 1. Назначение

Статический PHP/HTML-сайт бренда **Audurra** на базе шаблона Granita: каталог, поиск, форма обратной связи, карта представителей, редактирование текстов с сайта.

## 2. Требования

- **PHP 8.1+** (рекомендуется 8.2)
- Расширения: `json`, `mbstring`, `openssl`, `curl` (для SMTP)
- Веб-сервер **Apache** (mod_rewrite) или **Nginx** + PHP-FPM

## 3. Размещение

- Document root указывает на корень репозитория (где лежат `index.html`, `catalog/`, `contacts/`).
- Точка входа — `index.html` и прочие `.html` по путям URL.

## 4. Права на каталоги

Запись для PHP (пользователь веб-сервера):

- `catalog/api/data/` — overrides каталога, тексты страниц, представители
- При необходимости логи в отдельной папке вне git

## 5. Конфигурация

1. Скопировать `catalog/api/config.local.sample.php` → `catalog/api/config.local.php`
2. Скопировать `contacts/api/config.local.sample.php` → `contacts/api/config.local.php`
3. Заполнить SMTP, получателей формы, ключи **Yandex Smart Captcha** (публичный ключ в `contacts/contacts.html` уже из шаблона; секрет — только в `config.local.php`)
4. Настроить права пользователей редактирования (`page_text`, `catalog`, `dealers`) в `config.local.php`

**Не** коммитить `config.local.php` в git.

## 6. Сборка после правок меню/HTML

```powershell
cd <корень сайта>
node tools/site-chrome.mjs
node tools/build-search-index.mjs
```

Или `npm run build`, если настроен `package.json`.

## 7. HTTPS

Обязателен для капчи и внешних embed (Wistia). Настроить сертификат (Let's Encrypt и т.п.).

## 8. Постдеплой-проверки

- [ ] Главная, разделы what-is / working-with / why-audurra открываются
- [ ] Favicon и логотип Audurra в шапке
- [ ] Форма `contacts/contacts.html` отправляет письмо (тест)
- [ ] Капча проходит
- [ ] Поиск `search.html` находит новые страницы
- [ ] PDF каталога: `documents/Audurra_Catalogue_EN_2025-10.pdf`
- [ ] Каталог `catalog/` — демо-данные шаблона (при необходимости заменить товары)

## 9. Логи

Смотреть логи PHP и веб-сервера при ошибках отправки формы и API каталога.

## 10. Резервное копирование

Регулярно: файлы сайта, `catalog/api/data/*.json`, `config.local.php` (вне git).
