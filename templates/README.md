# Шаблоны шапки и подвала

Разметка общих блоков сайта вынесена в `partials/` и собирается в `assembly/`. Плейсхолдер `{{BASE}}` при сборке заменяется на `./` или `../...` в зависимости от глубины страницы.

## Файлы

| Файл | Назначение |
|------|------------|
| `partials/main-nav.html` | Главное меню (верхний уровень и выпадающие разделы) |
| `partials/top-meta.html` | Мета-навигация: поиск, «Мой New Site», соцсети |
| `partials/axalta-ribbon.html` | Верхняя лента Template Brand |
| `partials/external-disclaimer.html` | Модалка внешних ссылок |
| `partials/site-footer.html` | Подвал: собирает колонки + юрблок |
| `partials/footer-nav-columns.html` | Колонки ссылок в подвале |
| `partials/footer-legal.html` | Копирайт, ссылка на privacy, логотип Template Brand |
| `assembly/site-top.html` | Шапка: disclaimer + header + кнопка бургер + `@@include` фрагментов |
| `assembly/site-bottom.html` | `</footer>` + кнопка «наверх» |

В сборках `@@include('имя-файла.html')` подключает файлы **только** из `partials/`.

## Сборка

После правок в `templates/` запустите из корня репозитория:

```bash
npm run cromax:build
```

Скрипт обновит HTML между комментариями `<!-- SITE_TEMPLATE:BEGIN ... -->` / `<!-- SITE_TEMPLATE:END ... -->` во всех страницах. Новые страницы помечаются вручную той же парой, затем снова `npm run cromax:build`.

`npm run cromax:migrate` — одноразовая замена старых вставок на маркеры; для обычной работы не нужен (уже применён).

## Прочее

- Левое **facet-меню** и данные в `facet-sidebar.js` по-прежнему отдельно; при смене IA можно позже вынести список ссылок в JSON и подставлять в шаблон и в JS.
- `styles.css` и поведение в `script.js` не трогайте в шаблонах.
