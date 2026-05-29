(function () {
  const root = document.querySelector("[data-site-search-root]");
  if (!root) {
    return;
  }

  const MAX_PAGES = 50;
  const MAX_PRODUCTS = 80;

  const displayText =
    typeof window.normalizeCatalogDisplayText === "function"
      ? window.normalizeCatalogDisplayText.bind(window)
      : (x) => x;

  function normalizeQuery(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokensFromQuery(q) {
    return normalizeQuery(q)
      .split(/\s+/)
      .filter(Boolean);
  }

  function haystackPage(p) {
    const pathBit = String(p.path || "").replace(/[/._-]+/g, " ");
    return normalizeQuery(
      [p.title || "", p.description || "", p.h1 || "", pathBit].join(" ")
    );
  }

  function scoreAgainstHaystack(hay, toks) {
    let score = 0;
    for (let i = 0; i < toks.length; i += 1) {
      const t = toks[i];
      if (!t) {
        continue;
      }
      if (hay.includes(t)) {
        score += 12 + Math.min(t.length, 20);
      }
    }
    return score;
  }

  function searchPages(pages, toks) {
    if (!toks.length || !Array.isArray(pages)) {
      return [];
    }
    const out = [];
    for (let i = 0; i < pages.length; i += 1) {
      const p = pages[i];
      if (!p || !p.path) {
        continue;
      }
      const hay = haystackPage(p);
      const titleN = normalizeQuery(p.title || "");
      let score = scoreAgainstHaystack(hay, toks);
      for (let j = 0; j < toks.length; j += 1) {
        const t = toks[j];
        if (t && titleN.includes(t)) {
          score += 25;
        }
      }
      if (score > 0) {
        out.push({ entry: p, score });
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, MAX_PAGES).map((x) => x.entry);
  }

  function categoryLabel(slug) {
    const cats = window.CATALOG_CATEGORIES;
    if (!Array.isArray(cats)) {
      return String(slug || "");
    }
    const c = cats.find((x) => x && x.slug === slug);
    return c && c.label ? String(c.label) : String(slug || "");
  }

  function productHaystack(p, catLab) {
    const name = displayText(p.name);
    const sku = String(p.sku || "");
    const article = String(p.articleRef || "");
    const app = String(p.application || "");
    const ps = String(p.paintSystem || "");
    const ms = String(p.mixingSystem || "");
    return normalizeQuery(`${name} ${sku} ${article} ${catLab} ${app} ${ps} ${ms}`);
  }

  function searchProducts(products, toks) {
    if (!toks.length || !Array.isArray(products)) {
      return [];
    }
    const out = [];
    for (let i = 0; i < products.length; i += 1) {
      const p = products[i];
      if (!p || p.sku == null || String(p.sku).trim() === "") {
        continue;
      }
      const catLab = categoryLabel(p.category);
      const hay = productHaystack(p, catLab);
      const nameN = normalizeQuery(displayText(p.name));
      let score = scoreAgainstHaystack(hay, toks);
      for (let j = 0; j < toks.length; j += 1) {
        const t = toks[j];
        if (t && String(p.sku).toLowerCase().includes(t)) {
          score += 80;
        }
        if (t && nameN.includes(t)) {
          score += 35;
        }
      }
      if (score > 0) {
        out.push({ prod: p, score });
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, MAX_PRODUCTS).map((x) => x.prod);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function catalogProductImageSrc(img) {
    if (!img) {
      return "";
    }
    return `./catalog/${String(img).replace(/^\.\//, "")}`;
  }

  function render() {
    const params = new URLSearchParams(window.location.search);
    const qRaw = params.get("q") || "";
    const toks = tokensFromQuery(qRaw);
    const summary = document.getElementById("siteSearchSummary");
    const pagesHost = document.querySelector("[data-site-search-pages]");
    const prodHost = document.querySelector("[data-site-search-products]");
    const headerInput =
      document.querySelector('#searchBox input[name="q"]') || document.querySelector("#searchBox input");

    if (headerInput && qRaw) {
      headerInput.value = qRaw;
    }

    const pages = Array.isArray(window.SITE_SEARCH_PAGES) ? window.SITE_SEARCH_PAGES : [];
    const products = Array.isArray(window.CATALOG_PRODUCTS) ? window.CATALOG_PRODUCTS : [];

    if (!summary || !pagesHost || !prodHost) {
      return;
    }

    if (!toks.length) {
      summary.textContent =
        "Введите запрос в поле поиска в шапке страницы и нажмите Enter.";
      pagesHost.innerHTML = "";
      prodHost.innerHTML = "";
      return;
    }

    const pageHits = searchPages(pages, toks);
    const prodHits = searchProducts(products, toks);
    const queryLabel = escapeHtml(qRaw.trim());

    summary.textContent = `По запросу «${qRaw.trim()}»: страниц — ${pageHits.length}, товаров — ${prodHits.length}.`;

    pagesHost.innerHTML =
      pageHits.length > 0
        ? pageHits
            .map((p) => {
              const href = `./${p.path}`;
              const desc = p.description
                ? `<p class="site-search-hit-desc">${escapeHtml(p.description)}</p>`
                : "";
              return `<article class="catalog-product-row site-search-row">
<div class="catalog-product-inner site-search-page-inner">
<div class="catalog-product-text">
<h3 class="catalog-product-title"><a class="catalog-product-title-link" href="${escapeHtml(href)}">${escapeHtml(
                p.title
              )}</a></h3>
<p class="catalog-product-meta"><span class="catalog-product-label">Страница</span> <span class="catalog-product-value">${escapeHtml(
                p.path
              )}</span></p>${desc}
<p class="site-search-hit-actions"><a class="btn btn-primary site-search-hit-btn" href="${escapeHtml(href)}">Перейти</a></p></div></div></article>`;
            })
            .join("")
        : `<p class="site-search-empty" role="status">По запросу «${queryLabel}» на страницах сайта ничего не найдено.</p>`;

    prodHost.innerHTML =
      prodHits.length > 0
        ? prodHits
            .map((pr) => {
              const title = escapeHtml(displayText(pr.name));
              const skuEsc = escapeHtml(String(pr.sku));
              const catEsc = escapeHtml(categoryLabel(pr.category));
              const href = `./catalog/product.html?sku=${encodeURIComponent(String(pr.sku))}`;
              const imgSrc = catalogProductImageSrc(pr.image);
              const thumb = imgSrc
                ? `<a class="catalog-product-media-link site-search-product-media" href="${href}"><img class="catalog-product-img" src="${escapeHtml(
                    imgSrc
                  )}" alt="" loading="lazy" width="96" height="96"></a>`
                : `<span class="catalog-product-media-link site-search-product-media"><span class="catalog-product-thumb-placeholder"></span></span>`;
              return `<article class="catalog-product-row site-search-row">
<div class="catalog-product-inner">
<div class="catalog-product-media">${thumb}</div>
<div class="catalog-product-text">
<h3 class="catalog-product-title"><a class="catalog-product-title-link" href="${href}">${title}</a></h3>
<p class="catalog-product-meta"><span class="catalog-product-label">Артикул</span> <span class="catalog-product-value">${skuEsc}</span></p>
<p class="catalog-product-meta"><span class="catalog-product-label">Категория</span> <span class="catalog-product-value">${catEsc}</span></p>
<p class="site-search-hit-actions"><a class="btn btn-primary site-search-hit-btn" href="${href}">Перейти</a></p></div></div></article>`;
            })
            .join("")
        : `<p class="site-search-empty" role="status">По запросу «${queryLabel}» на страницах каталога товаров ничего не найдено.</p>`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
})();
