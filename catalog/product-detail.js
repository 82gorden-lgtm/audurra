(function () {
  const root = document.querySelector("[data-product-root]");
  if (!root) return;

  function runProductDetail() {
  const displayText =
    typeof window.normalizeCatalogDisplayText === "function"
      ? window.normalizeCatalogDisplayText.bind(window)
      : (s) => s;
  const params = new URLSearchParams(window.location.search);
  const sku = params.get("sku");
  const products = window.CATALOG_PRODUCTS || [];
  const categories = window.CATALOG_CATEGORIES || [];

  const errEl = root.querySelector("[data-product-error]");
  const bodyEl = root.querySelector("[data-product-body]");

  if (!sku) {
    errEl.hidden = false;
    bodyEl.hidden = true;
    return;
  }

  const prod = products.find((p) => String(p.sku) === String(sku));
  if (!prod) {
    errEl.hidden = false;
    bodyEl.hidden = true;
    return;
  }

  errEl.hidden = true;
  bodyEl.hidden = false;

  const catSlug = prod.category != null ? String(prod.category).trim() : "";
  if (catSlug) {
    const u = new URL(window.location.href);
    if (!u.searchParams.get("category")) {
      u.searchParams.set("category", catSlug);
      window.history.replaceState({}, "", `${u.pathname}${u.search}${u.hash}`);
    }
  }

  const titleEl = root.querySelector("[data-product-title]");
  const nameShown = displayText(prod.name);
  titleEl.textContent = nameShown;
  document.title = `${nameShown} \u2014 New Site`;

  const bc = document.querySelector("[data-product-breadcrumb]");
  if (bc) bc.textContent = nameShown;

  const bcPrefix = document.querySelector("[data-product-breadcrumb-prefix]");
  if (bcPrefix) {
    bcPrefix.replaceChildren();
    const slugSet = new Set();
    const addSlug = (s) => {
      const t = s != null ? String(s).trim() : "";
      if (!t || slugSet.has(t)) return;
      slugSet.add(t);
    };
    if (Array.isArray(prod.categories)) {
      prod.categories.forEach(addSlug);
    }
    addSlug(prod.category);
    const slugs = [...slugSet];
    slugs.forEach((slug) => {
      const meta = categories.find((c) => c.slug === slug);
      const label = meta ? meta.label : slug;
      const a = document.createElement("a");
      a.href = `./index.html?category=${encodeURIComponent(slug)}`;
      a.textContent = label;
      bcPrefix.appendChild(a);
      const sep = document.createElement("span");
      sep.className = "breadcrumb-sep";
      sep.setAttribute("aria-hidden", "true");
      bcPrefix.appendChild(sep);
    });
  }

  const img = root.querySelector("[data-product-image]");
  if (prod.image) {
    img.src = prod.image;
    img.alt = nameShown || "";
  }

  const sheetsRoot = root.querySelector("[data-product-sheets]");
  const tdsArticle = root.querySelector('[data-product-sheet="tds"]');
  const sdsArticle = root.querySelector('[data-product-sheet="sds"]');
  const tdsLink = root.querySelector("[data-product-tds]");
  const sdsLink = root.querySelector("[data-product-sds]");
  const rawTdsUrl = prod.technicalDataSheetUrl != null ? String(prod.technicalDataSheetUrl).trim() : "";
  const skuStr = prod.sku != null ? String(prod.sku).trim() : "";
  const isCrxTds =
    !!rawTdsUrl &&
    /sdstds\.crxcolor\.com/i.test(rawTdsUrl) &&
    /sheetType=tds/i.test(rawTdsUrl);
  /** Локальный PDF или страница-заглушка catalog/tds-soon.html, если файла нет (см. tds/missing-skus.json). */
  const tdsPdfUrl = isCrxTds && skuStr ? `./tds/${encodeURIComponent(skuStr)}.pdf` : "";
  const tdsSoonUrl = "./tds-soon.html";
  const rawSdsUrl = prod.safetyDataSheetUrl != null ? String(prod.safetyDataSheetUrl).trim() : "";
  const isCrxSds =
    !!rawSdsUrl &&
    /sdstds\.crxcolor\.com/i.test(rawSdsUrl) &&
    /sheetType=sds/i.test(rawSdsUrl);
  /** Локальный PDF или catalog/sds-soon.html; манифест sds/missing-skus.json — см. download-sds-ru.py */
  const sdsPdfUrl = isCrxSds && skuStr ? `./sds/${encodeURIComponent(skuStr)}.pdf` : "";
  const sdsSoonUrl = "./sds-soon.html";
  let hasAnySheet = false;
  if (tdsPdfUrl && tdsLink && tdsArticle) {
    tdsLink.href = tdsPdfUrl;
    tdsLink.target = "_blank";
    tdsLink.rel = "noopener noreferrer nofollow";
    tdsArticle.hidden = false;
    hasAnySheet = true;
    (function resolveTdsHref() {
      tdsLink.style.pointerEvents = "none";
      tdsLink.setAttribute("aria-busy", "true");
      const finish = () => {
        tdsLink.style.pointerEvents = "";
        tdsLink.removeAttribute("aria-busy");
      };
      const setSoon = () => {
        tdsLink.href = tdsSoonUrl;
        tdsLink.removeAttribute("target");
        finish();
      };
      const setPdf = () => {
        tdsLink.href = tdsPdfUrl;
        tdsLink.target = "_blank";
        tdsLink.rel = "noopener noreferrer nofollow";
        finish();
      };
      Promise.all([
        fetch("./tds/missing-skus.json", { cache: "no-cache" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(tdsPdfUrl, { method: "HEAD", cache: "no-cache" }).catch(() => null),
      ])
        .then(([data, hr]) => {
          if (hr && hr.ok) {
            setPdf();
            return;
          }
          const miss = data && Array.isArray(data.missing) ? data.missing.map(String) : null;
          if (miss && miss.includes(String(skuStr))) {
            setSoon();
            return;
          }
          if (hr) {
            setSoon();
            return;
          }
          fetch(tdsPdfUrl, { method: "HEAD", cache: "no-cache" })
            .then((h2) => {
              if (h2 && h2.ok) setPdf();
              else setSoon();
            })
            .catch(() => setSoon());
        })
        .catch(() => setSoon());
    })();
  } else if (!tdsPdfUrl && rawTdsUrl && tdsLink && tdsArticle) {
    tdsLink.href = rawTdsUrl;
    tdsLink.target = "_blank";
    tdsLink.rel = "noopener noreferrer nofollow";
    tdsArticle.hidden = false;
    hasAnySheet = true;
  } else if (tdsArticle) {
    tdsArticle.hidden = true;
  }
  if (sdsPdfUrl && sdsLink && sdsArticle) {
    sdsLink.href = sdsPdfUrl;
    sdsLink.target = "_blank";
    sdsLink.rel = "noopener noreferrer nofollow";
    sdsArticle.hidden = false;
    hasAnySheet = true;
    (function resolveSdsHref() {
      sdsLink.style.pointerEvents = "none";
      sdsLink.setAttribute("aria-busy", "true");
      const finish = () => {
        sdsLink.style.pointerEvents = "";
        sdsLink.removeAttribute("aria-busy");
      };
      const setSoon = () => {
        sdsLink.href = sdsSoonUrl;
        sdsLink.removeAttribute("target");
        finish();
      };
      const setPdf = () => {
        sdsLink.href = sdsPdfUrl;
        sdsLink.target = "_blank";
        sdsLink.rel = "noopener noreferrer nofollow";
        finish();
      };
      Promise.all([
        fetch("./sds/missing-skus.json", { cache: "no-cache" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(sdsPdfUrl, { method: "HEAD", cache: "no-cache" }).catch(() => null),
      ])
        .then(([data, hr]) => {
          if (hr && hr.ok) {
            setPdf();
            return;
          }
          const miss = data && Array.isArray(data.missing) ? data.missing.map(String) : null;
          if (miss && miss.includes(String(skuStr))) {
            setSoon();
            return;
          }
          if (hr) {
            setSoon();
            return;
          }
          fetch(sdsPdfUrl, { method: "HEAD", cache: "no-cache" })
            .then((h2) => {
              if (h2 && h2.ok) setPdf();
              else setSoon();
            })
            .catch(() => setSoon());
        })
        .catch(() => setSoon());
    })();
  } else if (!sdsPdfUrl && rawSdsUrl && sdsLink && sdsArticle) {
    sdsLink.href = rawSdsUrl;
    sdsLink.target = "_blank";
    sdsLink.rel = "noopener noreferrer nofollow";
    sdsArticle.hidden = false;
    hasAnySheet = true;
  } else if (sdsArticle) {
    sdsArticle.hidden = true;
  }
  if (sheetsRoot) {
    sheetsRoot.hidden = !hasAnySheet;
  }

  const euRoot = root.querySelector("[data-product-eu-description]");
  const introWrap = root.querySelector("[data-product-desc-intro-wrap]");
  const featRow = root.querySelector("[data-product-desc-features-row]");
  const featUl = root.querySelector("[data-product-desc-features]");
  const varHost = root.querySelector("[data-product-desc-variants]");
  const charHost = root.querySelector("[data-product-desc-char-groups]");
  const ru = prod.descriptionRu;

  function appendSpecRow(parent, labelText, valueText) {
    const row = document.createElement("div");
    row.className = "catalog-product-detail-eu-row catalog-product-detail-eu-row--spec";
    const key = document.createElement("div");
    key.className = "catalog-product-detail-eu-key";
    const h = document.createElement("h4");
    h.textContent = labelText;
    key.appendChild(h);
    const val = document.createElement("div");
    val.className = "catalog-product-detail-eu-value";
    const pp = document.createElement("p");
    pp.textContent = displayText(valueText);
    val.appendChild(pp);
    row.appendChild(key);
    row.appendChild(val);
    parent.appendChild(row);
  }

  introWrap.replaceChildren();
  featUl.replaceChildren();
  introWrap.hidden = true;
  featRow.hidden = true;
  euRoot.hidden = true;
  if (varHost) {
    varHost.replaceChildren();
    varHost.hidden = true;
  }
  if (charHost) {
    charHost.replaceChildren();
    charHost.hidden = true;
  }

  if (ru && typeof ru === "object") {
    let hasAny = false;
    const introText = ru.intro != null ? String(ru.intro).trim() : "";
    if (euRoot && introWrap) {
      if (introText) {
        const p = document.createElement("p");
        p.className = "catalog-product-detail-eu-marketing-text";
        p.textContent = displayText(introText);
        introWrap.appendChild(p);
        introWrap.hidden = false;
        hasAny = true;
      }
    }
    const bullets = Array.isArray(ru.bullets) ? ru.bullets : [];
    const bulletsShown = bullets.map((b) => String(b).trim()).filter(Boolean);
    const variantListRaw = Array.isArray(ru.variants) ? ru.variants : [];
    const VARIANT_OUT_OF_STOCK = "Нет в наличии";
    const variantList = variantListRaw.filter((grp) => {
      if (!grp || typeof grp !== "object") return false;
      const v0 = grp.variant != null ? String(grp.variant).trim() : "";
      return v0 !== VARIANT_OUT_OF_STOCK;
    });
    const hasVariants = variantList.length > 0;

    if (featRow && featUl) {
      if (bulletsShown.length) {
        for (let bi = 0; bi < bulletsShown.length; bi += 1) {
          const li = document.createElement("li");
          const pp = document.createElement("p");
          pp.textContent = displayText(bulletsShown[bi]);
          li.appendChild(pp);
          featUl.appendChild(li);
        }
      }
      featRow.hidden = !(bulletsShown.length || hasVariants);
      if (bulletsShown.length || hasVariants) hasAny = true;
    }

    if (varHost && hasVariants) {
      varHost.hidden = false;
      const skuCur = prod.sku != null ? String(prod.sku) : "";
      for (let vi = 0; vi < variantList.length; vi += 1) {
        const grp = variantList[vi];
        if (!grp || typeof grp !== "object") continue;
        const wrap = document.createElement("div");
        wrap.className = "catalog-product-detail-variant-group";
        const mc = grp.materialCode != null ? String(grp.materialCode).trim() : "";
        if (skuCur && mc === skuCur) {
          wrap.classList.add("catalog-product-detail-variant-group--current");
        }
        const v0 = grp.variant != null ? String(grp.variant).trim() : "";
        const ar = grp.articleRef != null ? String(grp.articleRef).trim() : "";
        if (v0) appendSpecRow(wrap, "Вариант", v0);
        if (ar) appendSpecRow(wrap, "Артикул", ar);
        if (mc) appendSpecRow(wrap, "Код материала", mc);
        varHost.appendChild(wrap);
      }
      hasAny = true;
    }

    const charGroupsRaw = Array.isArray(ru.characteristicGroups) ? ru.characteristicGroups : [];
    let hasCharGroups = false;
    if (charHost && charGroupsRaw.length > 0) {
      for (let ci = 0; ci < charGroupsRaw.length; ci += 1) {
        const cg = charGroupsRaw[ci];
        if (!cg || typeof cg !== "object") {
          continue;
        }
        const gTitle = cg.title != null ? String(cg.title).trim() : "";
        const rowsRaw = Array.isArray(cg.rows) ? cg.rows : [];
        const wrap = document.createElement("div");
        wrap.className = "catalog-product-detail-variant-group catalog-product-detail-char-group";
        if (gTitle) {
          const th = document.createElement("h4");
          th.className = "catalog-product-detail-char-group-title";
          th.textContent = displayText(gTitle);
          wrap.appendChild(th);
        }
        for (let ri = 0; ri < rowsRaw.length; ri += 1) {
          const r = rowsRaw[ri];
          if (!r || typeof r !== "object") {
            continue;
          }
          const lb = r.label != null ? String(r.label).trim() : "";
          const vl = r.value != null ? String(r.value).trim() : "";
          if (!lb && !vl) {
            continue;
          }
          appendSpecRow(wrap, lb || "—", vl || "—");
        }
        if (wrap.childElementCount > 0) {
          charHost.appendChild(wrap);
          hasCharGroups = true;
        }
      }
      charHost.hidden = !hasCharGroups;
      if (hasCharGroups) {
        hasAny = true;
      }
    }

    if (euRoot) {
      euRoot.hidden = !hasAny && !hasAnySheet;
    }
  } else if (euRoot) {
    euRoot.hidden = !hasAnySheet;
  }

  const layoutEl = root.querySelector(".catalog-product-detail-layout");
  if (layoutEl && euRoot) {
    layoutEl.classList.toggle("catalog-product-detail-layout--media-only", euRoot.hidden);
  }

  window.dispatchEvent(new CustomEvent("cromaxProductDetailRendered", { detail: { sku } }));
  }

  if (window.__CROMAX_OVERRIDES_APPLIED) runProductDetail();
  else window.addEventListener("cromaxOverridesMerged", runProductDetail, { once: true });
})();
