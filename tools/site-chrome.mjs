/**
 * Сборка общих фрагментов шапки и подвала шаблона (templates/):
 *   node tools/site-chrome.mjs           — подставить разметку между маркерами
 *   node tools/site-chrome.mjs --migrate — один раз: заменить дубли на маркеры, затем собрать
 */
import { existsSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  renderLeftSideNav,
  renderLeftSideNavStatic,
  sectionIdFromPagePath,
} from "./nav-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PARTIALS_DIR = path.join(ROOT, "templates", "partials");
const ASSEMBLY_DIR = path.join(ROOT, "templates", "assembly");

const BEGIN_TOP = "<!-- SITE_TEMPLATE:BEGIN site-top -->";
const END_TOP = "<!-- SITE_TEMPLATE:END site-top -->";
const BEGIN_BOTTOM = "<!-- SITE_TEMPLATE:BEGIN site-bottom -->";
const END_BOTTOM = "<!-- SITE_TEMPLATE:END site-bottom -->";
const BEGIN_LEFT_NAV = "<!-- SITE_TEMPLATE:BEGIN left-side-nav -->";
const END_LEFT_NAV = "<!-- SITE_TEMPLATE:END left-side-nav -->";

const HEADER_RE =
  /<div class="external-link-disclaimer"[\s\S]*?<button type="button" class="mobile-nav-backdrop"[^>]*>\s*<\/button>/;

/** Без \\s* после </button>, чтобы не съедать переносы перед <script> или модалками. */
const FOOTER_RE =
  /<footer class="site-footer"[\s\S]*?<\/footer>\s*(?:<button[^>]*\bid="backToTop"[^>]*>[\s\S]*?<\/button>)?/i;

function posixRel(p) {
  return p.split(path.sep).join("/");
}

function baseFromRelFile(rel) {
  const d = path.dirname(posixRel(rel).replace(/^\.\//, ""));
  if (d === "." || d === "") {
    return "./";
  }
  const depth = d.split("/").filter(Boolean).length;
  if (depth === 0) {
    return "./";
  }
  return "../".repeat(depth);
}

async function listHtmlFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && (e.name === "tmp" || e.name === "node_modules" || e.name === ".git" || e.name === "tools" || e.name === "templates")) {
      continue;
    }
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listHtmlFiles(full)));
    } else if (e.name.endsWith(".html")) {
      if (e.name.startsWith("tmp-")) {
        continue;
      }
      out.push(full);
    }
  }
  return out;
}

const includeRe = /@@include\(\s*['"]([^'"]+)['"]\s*\)/g;

function expandIncludes(s, nameStack) {
  return s.replace(includeRe, (_, rawName) => {
    const fileName = rawName.trim();
    const p = path.join(PARTIALS_DIR, fileName);
    if (nameStack.includes(p)) {
      throw new Error(`circular include: ${nameStack.join(" -> ")} -> ${fileName}`);
    }
    if (!p.startsWith(PARTIALS_DIR)) {
      throw new Error(`include outside partials: ${fileName}`);
    }
    const inner = requireReadSync(p);
    return expandIncludes(inner, [...nameStack, p]);
  });
}

function requireReadSync(p) {
  if (!existsSync(p)) {
    throw new Error(`Missing partial: ${p}`);
  }
  return readFileSync(p, "utf8");
}

function renderPartial(partialName, base) {
  const p = path.join(PARTIALS_DIR, partialName);
  let t = requireReadSync(p);
  t = expandIncludes(t, [p]);
  t = t.replaceAll("{{BASE}}", base);
  if (t.includes("{{BASE}}") || t.includes("@@include")) {
    throw new Error(`Unexpanded placeholder in ${partialName} after build`);
  }
  return t;
}

function renderAssembly(assemblyName, base) {
  const p = path.join(ASSEMBLY_DIR, assemblyName);
  let t = readFileSync(p, "utf8");
  t = expandIncludes(t, [p]);
  t = t.replaceAll("{{BASE}}", base);
  if (t.includes("{{BASE}}") || t.includes("@@include")) {
    throw new Error(`Unexpanded placeholder in ${assemblyName} after build`);
  }
  return t;
}

function replaceBlock(str, begin, end, newInner) {
  const i = str.indexOf(begin);
  if (i === -1) {
    return null;
  }
  const afterBegin = i + begin.length;
  const j = str.indexOf(end, afterBegin);
  if (j === -1) {
    return null;
  }
  return str.slice(0, afterBegin) + "\n" + newInner + "\n  " + str.slice(j);
}

function hasMarkers(content) {
  return content.includes(BEGIN_TOP) && content.includes(END_TOP);
}

async function migrateFile(relPath) {
  const full = path.join(ROOT, relPath);
  let content = await fs.readFile(full, "utf8");
  if (content.includes(BEGIN_TOP)) {
    return false;
  }
  if (!HEADER_RE.test(content)) {
    console.warn(`skip (no header match): ${relPath}`);
    return false;
  }
  if (!FOOTER_RE.test(content)) {
    console.warn(`skip (no footer match): ${relPath}`);
    return false;
  }
  const before = content;
  content = content.replace(HEADER_RE, BEGIN_TOP + "\n" + END_TOP);
  content = content.replace(FOOTER_RE, BEGIN_BOTTOM + "\n" + END_BOTTOM);
  if (content === before) {
    return false;
  }
  await fs.writeFile(full, content, "utf8");
  console.log("migrated:", relPath);
  return true;
}

async function expandFile(relPath) {
  const full = path.join(ROOT, relPath);
  const content = await fs.readFile(full, "utf8");
  if (!content.includes(BEGIN_TOP)) {
    return false;
  }
  const base = baseFromRelFile(relPath);
  const top = renderAssembly("site-top.html", base);
  const bottom = renderAssembly("site-bottom.html", base);
  const n1 = replaceBlock(content, BEGIN_TOP, END_TOP, top);
  if (n1 == null) {
    console.warn("expand: нет пары BEGIN/END site-top:", relPath);
    return false;
  }
  const n2 = replaceBlock(n1, BEGIN_BOTTOM, END_BOTTOM, bottom);
  if (n2 == null) {
    console.warn("expand: нет пары BEGIN/END site-bottom:", relPath);
    return false;
  }
  let n3 = n2;
  if (n2.includes(BEGIN_LEFT_NAV)) {
    const sectionId = sectionIdFromPagePath(relPath);
    const leftNav = sectionId
      ? renderLeftSideNav(base, sectionId, path.basename(relPath))
      : renderLeftSideNavStatic(base);
    n3 = replaceBlock(n2, BEGIN_LEFT_NAV, END_LEFT_NAV, leftNav);
  }
  if (n3 == null) {
    console.warn("expand: нет пары BEGIN/END left-side-nav:", relPath);
    return false;
  }
  if (n3 !== content) {
    await fs.writeFile(full, n3, "utf8");
    console.log("built:", relPath);
  }
  return true;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const all = (await listHtmlFiles(ROOT)).map((f) => posixRel(path.relative(ROOT, f)));
  if (args.has("--migrate")) {
    for (const rel of all) {
      await migrateFile(rel);
    }
  }
  for (const rel of all) {
    await expandFile(rel);
  }
  console.log("done, files:", all.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
