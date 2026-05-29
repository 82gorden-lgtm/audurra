import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const files = [
  "index.html",
  "working-with-audurra/how-to-use-our-products.html",
  "working-with-audurra/videos.html",
  "working-with-audurra/index.html",
  "what-is-audurra/plastic-repair.html",
];

const cspWistia =
  "default-src 'self'; script-src 'self' https://fast.wistia.com https://fast.wistia.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; img-src 'self' data: https: blob:; media-src 'self' blob: https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self' https://fast.wistia.net https://fast.wistia.com https://*.wistia.com; connect-src 'self' https://*.wistia.com https://*.wistia.net https://pipedream.wistia.com https://embed.wistia.com https://distillery.wistia.com;";

const cspIndex =
  "default-src 'self'; script-src 'self' https://smartcaptcha.cloud.yandex.ru https://fast.wistia.com https://fast.wistia.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; img-src 'self' data: https: blob:; media-src 'self' blob: https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self' https://smartcaptcha.cloud.yandex.ru https://fast.wistia.net https://fast.wistia.com https://*.wistia.com; connect-src 'self' https://smartcaptcha.cloud.yandex.ru https://*.wistia.com https://*.wistia.net https://pipedream.wistia.com https://embed.wistia.com https://distillery.wistia.com;";

const iframeRe =
  /<iframe src="https:\/\/fast\.wistia\.net\/embed\/iframe\/([^"]+)"[^>]*><\/iframe>/g;

const embedDiv =
  '<div class="wistia_embed wistia_async_$1 seo=false videoFoam=true" style="height:100%;left:0;position:absolute;top:0;width:100%;">&nbsp;</div>';

for (const rel of files) {
  const file = path.join(root, rel);
  let html = fs.readFileSync(file, "utf8");
  const csp = rel === "index.html" ? cspIndex : cspWistia;
  html = html.replace(
    /<meta http-equiv="Content-Security-Policy" content="[^"]*">/,
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
  );
  html = html.replace(iframeRe, embedDiv);
  if (html.includes("wistia_async_") && !html.includes("E-v1.js")) {
    html = html.replace(
      /(<script src="[^"]*script\.js" defer>)/,
      '<script src="https://fast.wistia.com/assets/external/E-v1.js" async></script>\n$1',
    );
  }
  fs.writeFileSync(file, html);
  console.log("updated", rel);
}
