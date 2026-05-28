import fs from "node:fs";
import path from "node:path";
import {
  LEFT_NAV_DIRS,
  renderLeftSideNav,
  renderLeftSideNavStatic,
  renderMainNavPartial,
  sectionIdFromPagePath,
} from "./nav-data.mjs";

const root = path.resolve(import.meta.dirname, "..");
const partialsDir = path.join(root, "templates", "partials");

const BEGIN_LEFT = "<!-- SITE_TEMPLATE:BEGIN left-side-nav -->";
const END_LEFT = "<!-- SITE_TEMPLATE:END left-side-nav -->";

function replaceLeftNav(html, navHtml) {
  const re = new RegExp(`${BEGIN_LEFT}[\\s\\S]*?${END_LEFT}`, "m");
  if (!re.test(html)) return null;
  return html.replace(re, `${BEGIN_LEFT}\n${navHtml}\n\n  ${END_LEFT}`);
}

// 1) main-nav.html из nav-data
fs.writeFileSync(
  path.join(partialsDir, "main-nav.html"),
  renderMainNavPartial("{{BASE}}"),
  "utf8",
);
console.log("updated templates/partials/main-nav.html");

fs.writeFileSync(
  path.join(partialsDir, "left-side-nav.html"),
  renderLeftSideNavStatic("{{BASE}}"),
  "utf8",
);
console.log("updated templates/partials/left-side-nav.html");

// 2) левое меню на страницах разделов
for (const dir of LEFT_NAV_DIRS) {
  const folder = path.join(root, dir);
  if (!fs.existsSync(folder)) continue;
  for (const file of fs.readdirSync(folder)) {
    if (!file.endsWith(".html")) continue;
    const rel = `${dir}/${file}`;
    const sectionId = sectionIdFromPagePath(rel);
    if (!sectionId) continue;
    const fp = path.join(folder, file);
    let html = fs.readFileSync(fp, "utf8");
    const navHtml = renderLeftSideNav("../", sectionId, file);
    const updated = replaceLeftNav(html, navHtml);
    if (!updated) {
      console.warn("skip (no left nav markers):", rel);
      continue;
    }
    html = updated;
    html = html.replace(
      /class="col-lg-9 col-md-12 col-sm-12 col-xs-12 noPadding"/g,
      'class="col-lg-9 col-md-12 col-sm-12 col-xs-12 facetMain"',
    );
    fs.writeFileSync(fp, html);
    console.log("left nav:", rel);
  }
}

console.log("Done. Run: node tools/site-chrome.mjs  — чтобы обновить шапку на всех HTML.");
