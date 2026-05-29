#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Добавляет data-cromax-text-key к текстовым блокам внутри <main> для редактора «Тексты страницы».
Пропускает: catalog/**, **/where-to-buy.html, templates/**, tmp-*.html, инструментальные страницы tools/**.
Запуск из корня репозитория: python scripts/annotate-page-text-keys.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Comment

ROOT = Path(__file__).resolve().parents[1]
INLINE_TAGS = frozenset({"strong", "em", "b", "i", "span", "a", "br", "small", "sub", "sup"})


def skip_path(rel: Path) -> bool:
    parts_lower = [p.lower() for p in rel.parts]
    if "catalog" in parts_lower:
        return True
    if "templates" in parts_lower:
        return True
    if "tools" in parts_lower:
        return True
    if "tmp" in parts_lower:
        return True
    name = rel.name.lower()
    if name == "where-to-buy.html":
        return True
    if name.startswith("tmp-") and name.endswith(".html"):
        return True
    return False


def page_key_prefix(rel: Path) -> str:
    if rel.as_posix().lower() == "index.html":
        return "home"
    stem = rel.with_suffix("").as_posix().replace("/", ".").replace("\\", ".")
    stem = re.sub(r"[^a-zA-Z0-9_.-]+", "-", stem)
    stem = re.sub(r"-+", "-", stem).strip(".-")
    return stem or "page"


def has_key(el) -> bool:
    return el.has_attr("data-cromax-text-key")


def inside_excluded_ancestor(el) -> bool:
    for a in el.parents:
        if a.name in ("svg", "script", "style", "noscript", "template"):
            return True
        if getattr(a, "attrs", None) and a.get("id") == "searchBox":
            return True
    return False


def sole_anchor_child(p):
    """Если <p> содержит только один элемент и это <a> (без значимого текста снаружи), вернуть этот <a>."""
    if p.name != "p":
        return None
    found_a = None
    for c in p.children:
        if isinstance(c, NavigableString):
            if str(c).strip():
                return None
        elif getattr(c, "name", None) == "a":
            if found_a is not None:
                return None
            found_a = c
        else:
            return None
    return found_a


def flatten_inline_only(el) -> None:
    """Заменить содержимое на plain text, если внутри только инлайновая разметка (редактор всё равно пишет textContent)."""
    if el.name == "p" and sole_anchor_child(el) is not None:
        return
    allowed = {"p", "h1", "h2", "h3", "h4", "h5", "h6", "li"}
    if el.name == "div" and "linktext" in el.get("class", []):
        allowed = allowed | {"div"}
    elif el.name == "a" and "btn" in el.get("class", []):
        allowed = allowed | {"a"}
    elif el.name == "label":
        allowed = allowed | {"label"}
    if el.name not in allowed:
        return
    for child in el.children:
        if isinstance(child, NavigableString):
            continue
        if isinstance(child, Comment):
            return
        if child.name not in INLINE_TAGS:
            return
    text = el.get_text(separator=" ", strip=True)
    if not text:
        return
    el.clear()
    el.append(text)


def meaningful_text(el) -> str:
    t = el.get_text(separator=" ", strip=True)
    if not t:
        return ""
    if t.replace("\xa0", " ").strip() == "":
        return ""
    return t


def should_key_li(li) -> bool:
    for child in li.children:
        if isinstance(child, NavigableString):
            continue
        if child.name in {"ul", "ol", "p", "div", "section", "article", "h1", "h2", "h3", "h4", "h5", "h6"}:
            return False
    return True


def annotate_main(main, prefix: str) -> int:
    added = 0
    n = 0

    def next_key() -> str:
        nonlocal n
        n += 1
        return f"{prefix}.edit{n:03d}"

    # Обход в порядке документа
    for el in main.find_all(True):
        if inside_excluded_ancestor(el):
            continue
        if has_key(el):
            continue

        tag = el.name

        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            flatten_inline_only(el)
            t = meaningful_text(el)
            if not t:
                continue
            el["data-cromax-text-key"] = next_key()
            added += 1
            continue

        if tag == "p":
            if sole_anchor_child(el) is not None:
                continue
            flatten_inline_only(el)
            t = meaningful_text(el)
            if not t:
                continue
            el["data-cromax-text-key"] = next_key()
            added += 1
            continue

        if tag == "li":
            if not should_key_li(el):
                continue
            flatten_inline_only(el)
            t = meaningful_text(el)
            if not t:
                continue
            el["data-cromax-text-key"] = next_key()
            added += 1
            continue

        if tag == "span" and "passenger-category-tile-label" in el.get("class", []):
            t = meaningful_text(el)
            if not t:
                continue
            el["data-cromax-text-key"] = next_key()
            added += 1
            continue

        # Текст быстрых ссылок на главной: второй span с текстом
        if tag == "a" and "quick-link" in el.get("class", []):
            spans = el.find_all("span", recursive=False)
            if len(spans) < 2:
                continue
            label = spans[-1]
            if has_key(label):
                continue
            t = meaningful_text(label)
            if not t:
                continue
            label["data-cromax-text-key"] = next_key()
            added += 1
            continue

        # Кнопки в hero / карточках (часто только текст внутри)
        if tag == "a" and "btn" in el.get("class", []):
            if el.find(["svg", "img"]):
                continue
            flatten_inline_only(el)
            t = meaningful_text(el)
            if not t:
                continue
            el["data-cromax-text-key"] = next_key()
            added += 1
            continue

        if tag == "span" and "btn" in el.get("class", []):
            flatten_inline_only(el)
            t = meaningful_text(el)
            if not t:
                continue
            el["data-cromax-text-key"] = next_key()
            added += 1
            continue

        # Подпись «ПОДРОБНЕЕ» в карточках (div.linktext)
        if tag == "div" and "linktext" in el.get("class", []):
            flatten_inline_only(el)
            t = meaningful_text(el)
            if not t:
                continue
            el["data-cromax-text-key"] = next_key()
            added += 1
            continue

        if tag == "label":
            flatten_inline_only(el)
            t = meaningful_text(el)
            if not t:
                continue
            el["data-cromax-text-key"] = next_key()
            added += 1
            continue

        # submit-кнопки контактов
        if tag == "input" and el.get("type") == "submit" and el.get("value"):
            el["data-cromax-text-key"] = next_key()
            added += 1
            continue

    return added


def process_file(path: Path) -> tuple[bool, int]:
    text = path.read_text(encoding="utf-8")
    if "data-cromax-text-key" not in text and "<main" not in text.lower():
        return False, 0

    soup = BeautifulSoup(text, "html.parser")
    main = soup.find("main")
    if not main:
        return False, 0

    prefix = page_key_prefix(path.relative_to(ROOT))
    added = annotate_main(main, prefix)
    if added == 0:
        return False, 0

    out = str(soup)
    if out.endswith("\n"):
        path.write_text(out, encoding="utf-8")
    else:
        path.write_text(out + "\n", encoding="utf-8")
    return True, added


def main() -> int:
    if not ROOT.exists():
        print("ROOT missing", ROOT, file=sys.stderr)
        return 1

    html_files = sorted(ROOT.rglob("*.html"))
    changed = 0
    total_keys = 0
    for path in html_files:
        rel = path.relative_to(ROOT)
        if skip_path(rel):
            continue
        ok, n = process_file(path)
        if ok:
            changed += 1
            total_keys += n
            print(f"+ {rel.as_posix()}  ({n} блоков)")

    print(f"\nГотово: файлов изменено {changed}, ключей добавлено {total_keys}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
