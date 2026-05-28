/**
 * Сканирует статические HTML в корне сайта и генерирует search-index.js
 * для клиентского поиска по страницам.
 *
 * Запуск из корня репозитория: node tools/build-search-index.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SKIP_DIR_NAMES = new Set(["templates", "tools", "node_modules", ".git", ".github", "tmp"]);

function shouldSkipFile(relPosix, baseName) {
  if (baseName.startsWith("tmp-")) return true;
  if (relPosix.startsWith("tmp/")) return true;
  if (relPosix.includes("/templates/") || relPosix.startsWith("templates/")) return true;
  return false;
}

function walkHtmlFiles(dirAbs, baseRel = "") {
  /** @type {string[]} */
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const name = ent.name;
    if (SKIP_DIR_NAMES.has(name)) continue;
    const childAbs = path.join(dirAbs, name);
    const childRel = path.join(baseRel, name).split(path.sep).join("/");
    if (ent.isDirectory()) {
      out.push(...walkHtmlFiles(childAbs, childRel));
      continue;
    }
    if (!ent.isFile() || !name.toLowerCase().endsWith(".html")) continue;
    if (shouldSkipFile(childRel, name)) continue;
    out.push(childRel);
  }
  return out;
}

function decodeBasicEntities(html) {
  return html
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      try {
        return String.fromCodePoint(parseInt(h, 16));
      } catch {
        return "";
      }
    })
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(html) {
  return decodeBasicEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function pickTitle(html) {
  const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? stripTags(m[1]) : "";
}

function pickMeta(html, metaName) {
  const escaped = metaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(`<meta\\b[^>]*name=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta\\b[^>]*content=["']([^"']*)["'][^>]*name=["']${escaped}["']`, "i");
  let m = re1.exec(html);
  if (!m) m = re2.exec(html);
  return m ? stripTags(m[1]) : "";
}

function pickFirstH1(html) {
  const m = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return m ? stripTags(m[1]) : "";
}

/** @typedef {{ path: string, title: string, description?: string, h1?: string }} SearchPageEntry */

function extractEntry(relPosix, htmlRaw) {
  const title = pickTitle(htmlRaw);
  const description = pickMeta(htmlRaw, "description");
  const h1 = pickFirstH1(htmlRaw);
  /** @type {SearchPageEntry} */
  const e = {
    path: relPosix,
    title: title || relPosix,
  };
  if (description) e.description = description;
  if (h1 && h1 !== title) e.h1 = h1;
  return e;
}

function main() {
  const htmlFiles = walkHtmlFiles(ROOT).sort((a, b) => a.localeCompare(b));
  /** @type {SearchPageEntry[]} */
  const pages = [];
  for (const rel of htmlFiles) {
    const abs = path.join(ROOT, rel.split("/").join(path.sep));
    let raw = "";
    try {
      raw = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    pages.push(extractEntry(rel, raw));
  }

  const outPath = path.join(ROOT, "search-index.js");
  const preamble = `/* Автоматически сгенерировано: node tools/build-search-index.mjs — не править вручную */\n`;

  const serialized = `${preamble}(function(){window.SITE_SEARCH_PAGES=${JSON.stringify(pages)}})();\n`;
  fs.writeFileSync(outPath, serialized, "utf8");

  console.log(`search-index.js: записано ${pages.length} страниц в ${path.relative(process.cwd(), outPath)}`);
}

main();
