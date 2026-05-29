(function () {
  const root = document.querySelector("[data-product-root]");
  if (!root || typeof window.getCromaxApiBase !== "function") {
    return;
  }

  function apiUrl(name) {
    return new URL(name, window.getCromaxApiBase()).href;
  }

  /**
   * Полный абсолютный URL для полей редактора (как у посетителя на cromax-russia.ru).
   * Относительные пути каталога разрешаются от текущей страницы (catalog/product.html).
   */
  function toAbsolutePublicHref(href) {
    const t = href != null ? String(href).trim() : "";
    if (!t) {
      return "";
    }
    if (/^https?:\/\//i.test(t)) {
      return t;
    }
    try {
      return new URL(t, window.location.href).href;
    } catch {
      return t;
    }
  }

  /** Та же логика, что в product-detail.js: локальный PDF или страница-заглушка. */
  function resolveLocalSheetHref(pdfRelUrl, skuStr, missingSkusJsonRel, soonRel) {
    return Promise.all([
      fetch(missingSkusJsonRel, { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(pdfRelUrl, { method: "HEAD", cache: "no-cache" }).catch(() => null),
    ])
      .then(([data, hr]) => {
        if (hr && hr.ok) {
          return pdfRelUrl;
        }
        const miss = data && Array.isArray(data.missing) ? data.missing.map(String) : null;
        if (miss && miss.includes(String(skuStr))) {
          return soonRel;
        }
        if (hr) {
          return soonRel;
        }
        return fetch(pdfRelUrl, { method: "HEAD", cache: "no-cache" })
          .then((h2) => (h2 && h2.ok ? pdfRelUrl : soonRel))
          .catch(() => soonRel);
      })
      .catch(() => soonRel);
  }

  /**
   * URL для полей редактора: на сайте для CRX ведут на ./tds|sds/… или soon, не на sdstds.crxcolor.com.
   * @returns {Promise<{ tdsHref: string, sdsHref: string }>}
   */
  function effectiveSheetUrlsForEditor(prod) {
    const skuStr = prod.sku != null ? String(prod.sku).trim() : "";
    const rawTds = prod.technicalDataSheetUrl != null ? String(prod.technicalDataSheetUrl).trim() : "";
    const rawSds = prod.safetyDataSheetUrl != null ? String(prod.safetyDataSheetUrl).trim() : "";
    const isCrxTds =
      !!rawTds && /sdstds\.crxcolor\.com/i.test(rawTds) && /sheetType=tds/i.test(rawTds);
    const isCrxSds =
      !!rawSds && /sdstds\.crxcolor\.com/i.test(rawSds) && /sheetType=sds/i.test(rawSds);
    const tdsPdfUrl = isCrxTds && skuStr ? `./tds/${encodeURIComponent(skuStr)}.pdf` : "";
    const sdsPdfUrl = isCrxSds && skuStr ? `./sds/${encodeURIComponent(skuStr)}.pdf` : "";

    const tdsPromise =
      tdsPdfUrl && skuStr
        ? resolveLocalSheetHref(tdsPdfUrl, skuStr, "./tds/missing-skus.json", "./tds-soon.html")
        : Promise.resolve(rawTds);
    const sdsPromise =
      sdsPdfUrl && skuStr
        ? resolveLocalSheetHref(sdsPdfUrl, skuStr, "./sds/missing-skus.json", "./sds-soon.html")
        : Promise.resolve(rawSds);

    return Promise.all([tdsPromise, sdsPromise]).then(([tdsHref, sdsHref]) => ({
      tdsHref: toAbsolutePublicHref(tdsHref != null ? String(tdsHref) : ""),
      sdsHref: toAbsolutePublicHref(sdsHref != null ? String(sdsHref) : ""),
    }));
  }

  function createVariantCardElement(v) {
    const wrap = document.createElement("div");
    wrap.className = "cromax-variant-card";
    wrap.dataset.cromaxVariantCard = "";
    const grid = document.createElement("div");
    grid.className = "cromax-variant-fields";
    const fields = [
      { key: "variant", label: "Вариант" },
      { key: "articleRef", label: "Артикул" },
      { key: "materialCode", label: "Код материала" },
    ];
    for (let i = 0; i < fields.length; i += 1) {
      const { key, label } = fields[i];
      const field = document.createElement("div");
      field.className = "cromax-field cromax-field--compact";
      const lab = document.createElement("label");
      lab.textContent = label;
      const inp = document.createElement("input");
      inp.type = "text";
      inp.autocomplete = "off";
      inp.dataset.cromaxVariantField = key;
      inp.value = v && v[key] != null ? String(v[key]) : "";
      field.append(lab, inp);
      grid.appendChild(field);
    }
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "btn btn-ghost cromax-variant-remove";
    rm.textContent = "Удалить вариант";
    rm.dataset.cromaxRemoveVariant = "";
    wrap.append(grid, rm);
    return wrap;
  }

  function collectVariantsFromHost(panel) {
    const host = panel.querySelector("#cromaxEditVariantsHost");
    if (!host) {
      return [];
    }
    const out = [];
    host.querySelectorAll("[data-cromax-variant-card]").forEach((card) => {
      const o = { variant: "", articleRef: "", materialCode: "" };
      card.querySelectorAll("[data-cromax-variant-field]").forEach((inp) => {
        if (!(inp instanceof HTMLInputElement)) {
          return;
        }
        const k = inp.dataset.cromaxVariantField;
        if (k === "variant" || k === "articleRef" || k === "materialCode") {
          o[k] = inp.value.trim();
        }
      });
      if (o.variant || o.articleRef || o.materialCode) {
        out.push(o);
      }
    });
    return out;
  }

  function renderVariantsForEdit(panel, variants) {
    const host = panel.querySelector("#cromaxEditVariantsHost");
    if (!host) {
      return;
    }
    host.replaceChildren();
    const list = Array.isArray(variants) && variants.length > 0 ? variants : [];
    if (list.length === 0) {
      host.appendChild(createVariantCardElement({}));
    } else {
      for (let i = 0; i < list.length; i += 1) {
        host.appendChild(createVariantCardElement(list[i]));
      }
    }
  }

  function bindVariantsEditor(panel) {
    const host = panel.querySelector("#cromaxEditVariantsHost");
    const addBtn = panel.querySelector("#cromaxEditAddVariant");
    if (!host || !addBtn || host.dataset.cromaxVariantBound === "1") {
      return;
    }
    host.dataset.cromaxVariantBound = "1";
    addBtn.addEventListener("click", () => {
      host.appendChild(createVariantCardElement({}));
    });
    host.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) {
        return;
      }
      if (t.closest("[data-cromax-remove-variant]")) {
        e.preventDefault();
        t.closest("[data-cromax-variant-card]")?.remove();
        if (host.querySelectorAll("[data-cromax-variant-card]").length === 0) {
          host.appendChild(createVariantCardElement({}));
        }
      }
    });
  }

  let currentSku = "";
  let panelBackdrop = null;
  let toolbarEl = null;

  function ensurePanel() {
    if (panelBackdrop) {
      return panelBackdrop;
    }
    panelBackdrop = document.createElement("div");
    panelBackdrop.id = "cromaxProductEditBackdrop";
    panelBackdrop.className = "cromax-editor-backdrop";
    panelBackdrop.hidden = true;
    panelBackdrop.setAttribute("role", "dialog");
    panelBackdrop.setAttribute("aria-modal", "true");
    panelBackdrop.setAttribute("aria-labelledby", "cromaxProductEditTitle");
    panelBackdrop.innerHTML = [
      '<div class="cromax-editor-sheet">',
      '  <div class="cromax-editor-head">',
      '    <h2 id="cromaxProductEditTitle" class="cromax-editor-title">Редактирование карточки</h2>',
      '    <div class="cromax-editor-head-actions">',
      '      <button type="button" class="btn btn-ghost cromax-editor-logout" id="cromaxEditorLogout">Выйти</button>',
      '      <button type="button" class="cromax-modal-close cromax-editor-close" id="cromaxEditorClose" aria-label="Закрыть">&times;</button>',
      "    </div>",
      "  </div>",
      '  <div class="cromax-editor-body">',
      '    <form id="cromaxProductEditForm" class="cromax-editor-form">',
      '      <section class="cromax-editor-section">',
      '        <h3 class="cromax-editor-section-title">Основное</h3>',
      '        <div class="cromax-field">',
      '          <label for="cromaxEditName">Название</label>',
      '          <input type="text" id="cromaxEditName" name="name" autocomplete="off">',
      "        </div>",
      '        <div class="cromax-field">',
      '          <label for="cromaxEditImage">URL изображения</label>',
      '          <input type="text" id="cromaxEditImage" name="image" placeholder="https://… или ./img/…">',
      "        </div>",
      "      </section>",
      '      <section class="cromax-editor-section">',
      '        <h3 class="cromax-editor-section-title">Описание (RU)</h3>',
      '        <div class="cromax-field">',
      '          <label for="cromaxEditIntro">Вводный текст</label>',
      '          <textarea id="cromaxEditIntro" name="intro" rows="4"></textarea>',
      "        </div>",
      '        <div class="cromax-field">',
      '          <label for="cromaxEditBullets">Особенности (каждая строка — отдельный пункт)</label>',
      '          <textarea id="cromaxEditBullets" name="bullets" rows="6"></textarea>',
      "        </div>",
      "      </section>",
      '      <section class="cromax-editor-section">',
      '        <h3 class="cromax-editor-section-title">Варианты исполнения</h3>',
      '        <p class="cromax-editor-hint">Только три поля: вариант, артикул, код материала. Блок с полями показывается сразу; при нескольких фасовках нажмите «Добавить вариант».</p>',
      '        <div id="cromaxEditVariantsHost" class="cromax-variants-host"></div>',
      '        <button type="button" class="btn btn-ghost cromax-variant-add-btn" id="cromaxEditAddVariant">Добавить вариант</button>',
      "      </section>",
      '      <section class="cromax-editor-section">',
      '        <h3 class="cromax-editor-section-title">Документы и ссылки</h3>',
      '        <div class="cromax-field">',
      '          <label for="cromaxEditTds">Полная ссылка на TDS (cromax-russia.ru)</label>',
      '          <p class="cromax-editor-field-hint">Указывается полный URL, например <code>https://cromax-russia.ru/catalog/tds/SKU.pdf</code> или <code>https://cromax-russia.ru/catalog/tds-soon.html</code> — как открывается у посетителя.</p>',
      '          <input type="text" id="cromaxEditTds" name="tds" autocomplete="off">',
      "        </div>",
      '        <div class="cromax-field">',
      '          <label for="cromaxEditSds">Полная ссылка на SDS (cromax-russia.ru)</label>',
      '          <p class="cromax-editor-field-hint">Полный URL, например <code>https://cromax-russia.ru/catalog/sds/SKU.pdf</code> или <code>https://cromax-russia.ru/catalog/sds-soon.html</code>.</p>',
      '          <input type="text" id="cromaxEditSds" name="sds" autocomplete="off">',
      "        </div>",
      '        <div class="cromax-field">',
      '          <label for="cromaxEditProductPage">Страница продукта (EU / внешняя)</label>',
      '          <input type="url" id="cromaxEditProductPage" name="productPage">',
      "        </div>",
      "      </section>",
      '      <p class="cromax-form-error" id="cromaxEditError" hidden></p>',
      '      <div class="cromax-editor-footer">',
      '        <button type="submit" class="btn btn-primary" id="cromaxEditSave">Сохранить</button>',
      '        <button type="button" class="btn btn-ghost" id="cromaxEditCancel">Отмена</button>',
      "      </div>",
      "    </form>",
      "  </div>",
      "</div>",
    ].join("");
    document.body.appendChild(panelBackdrop);
    bindVariantsEditor(panelBackdrop);

    const close = () => {
      panelBackdrop.hidden = true;
      document.body.classList.remove("cromax-modal-open");
    };

    panelBackdrop.querySelector("#cromaxEditorClose")?.addEventListener("click", close);
    panelBackdrop.querySelector("#cromaxEditCancel")?.addEventListener("click", close);
    panelBackdrop.addEventListener("click", (e) => {
      if (e.target === panelBackdrop) {
        close();
      }
    });

    panelBackdrop.querySelector("#cromaxEditorLogout")?.addEventListener("click", () => {
      fetch(apiUrl("logout.php"), { method: "POST", credentials: "same-origin" })
        .finally(() => {
          window.location.reload();
        });
    });

    panelBackdrop.querySelector("#cromaxProductEditForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const err = panelBackdrop.querySelector("#cromaxEditError");
      if (err) {
        err.hidden = true;
        err.textContent = "";
      }
      const name = panelBackdrop.querySelector("#cromaxEditName");
      const image = panelBackdrop.querySelector("#cromaxEditImage");
      const intro = panelBackdrop.querySelector("#cromaxEditIntro");
      const bullets = panelBackdrop.querySelector("#cromaxEditBullets");
      const tds = panelBackdrop.querySelector("#cromaxEditTds");
      const sds = panelBackdrop.querySelector("#cromaxEditSds");
      const page = panelBackdrop.querySelector("#cromaxEditProductPage");
      const bulletLines =
        bullets instanceof HTMLTextAreaElement
          ? bullets.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
          : [];
      const patch = {
        name: name instanceof HTMLInputElement ? name.value.trim() : "",
        image: image instanceof HTMLInputElement ? image.value.trim() : "",
        technicalDataSheetUrl: tds instanceof HTMLInputElement ? tds.value.trim() : "",
        safetyDataSheetUrl: sds instanceof HTMLInputElement ? sds.value.trim() : "",
        productPageUrl: page instanceof HTMLInputElement ? page.value.trim() : "",
        descriptionRu: {
          intro: intro instanceof HTMLTextAreaElement ? intro.value : "",
          bullets: bulletLines,
          variants: collectVariantsFromHost(panelBackdrop),
        },
      };

      fetch(apiUrl("save-product.php"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: currentSku, patch }),
      })
        .then((r) =>
          r.json().then((data) => ({
            ok: r.ok && data && data.ok,
            data,
          }))
        )
        .then(({ ok, data }) => {
          if (ok) {
            window.location.reload();
            return;
          }
          let msg = "Не удалось сохранить.";
          if (data && data.error === "unauthorized") {
            msg = "Сессия истекла. Войдите снова через «Мой New Site».";
          } else if (data && data.error === "forbidden_capability") {
            msg = "Нет прав на правку каталога. Обратитесь к администратору.";
          } else if (data && data.error === "write_failed") {
            msg = "Нет прав на запись на сервере (папка catalog/api/data).";
          }
          if (err) {
            err.textContent = msg;
            err.hidden = false;
          }
        })
        .catch(() => {
          if (err) {
            err.textContent = "Ошибка сети.";
            err.hidden = false;
          }
        });
    });

    return panelBackdrop;
  }

  function fillFormFromProduct(prod) {
    const panel = ensurePanel();
    const name = panel.querySelector("#cromaxEditName");
    const image = panel.querySelector("#cromaxEditImage");
    const intro = panel.querySelector("#cromaxEditIntro");
    const bullets = panel.querySelector("#cromaxEditBullets");
    const tds = panel.querySelector("#cromaxEditTds");
    const sds = panel.querySelector("#cromaxEditSds");
    const page = panel.querySelector("#cromaxEditProductPage");
    if (name instanceof HTMLInputElement) {
      name.value = prod.name != null ? String(prod.name) : "";
    }
    if (image instanceof HTMLInputElement) {
      image.value = prod.image != null ? String(prod.image) : "";
    }
    const ru = prod.descriptionRu && typeof prod.descriptionRu === "object" ? prod.descriptionRu : {};
    if (intro instanceof HTMLTextAreaElement) {
      intro.value = ru.intro != null ? String(ru.intro) : "";
    }
    if (bullets instanceof HTMLTextAreaElement) {
      const bl = Array.isArray(ru.bullets) ? ru.bullets : [];
      bullets.value = bl.map((b) => String(b)).join("\n");
    }
    if (tds instanceof HTMLInputElement) {
      tds.value = "";
    }
    if (sds instanceof HTMLInputElement) {
      sds.value = "";
    }
    effectiveSheetUrlsForEditor(prod).then(({ tdsHref, sdsHref }) => {
      if (tds instanceof HTMLInputElement) {
        tds.value = tdsHref;
      }
      if (sds instanceof HTMLInputElement) {
        sds.value = sdsHref;
      }
    });
    if (page instanceof HTMLInputElement) {
      page.value = prod.productPageUrl != null ? String(prod.productPageUrl) : "";
    }
    const vars = Array.isArray(ru.variants) ? ru.variants : [];
    renderVariantsForEdit(panel, vars);
  }

  function openPanel(prod) {
    const panel = ensurePanel();
    fillFormFromProduct(prod);
    const err = panel.querySelector("#cromaxEditError");
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }
    panel.hidden = false;
    document.body.classList.add("cromax-modal-open");
    panel.querySelector("#cromaxEditName")?.focus();
  }

  function ensureToolbar(header) {
    if (toolbarEl) {
      return;
    }
    toolbarEl = document.createElement("div");
    toolbarEl.className = "cromax-product-toolbar";
    toolbarEl.hidden = true;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost cromax-product-edit-btn";
    btn.textContent = "Редактировать карточку";
    btn.addEventListener("click", () => {
      const products = window.CATALOG_PRODUCTS || [];
      const prod = products.find((p) => String(p.sku) === String(currentSku));
      if (prod) {
        openPanel(prod);
      }
    });
    toolbarEl.appendChild(btn);
    header.appendChild(toolbarEl);
  }

  function syncToolbarVisibility() {
    if (!toolbarEl) {
      return;
    }
    window.fetchCromaxSession().then((data) => {
      const allow =
        data &&
        data.ok &&
        (typeof window.cromaxSessionHasCapability === "function"
          ? window.cromaxSessionHasCapability(data, "catalog")
          : true);
      toolbarEl.hidden = !allow;
    });
  }

  window.addEventListener("cromaxProductDetailRendered", (ev) => {
    const sku = ev.detail && ev.detail.sku != null ? String(ev.detail.sku) : "";
    if (!sku) {
      return;
    }
    currentSku = sku;
    const header = root.querySelector(".catalog-page-header");
    if (!header) {
      return;
    }
    ensureToolbar(header);
    syncToolbarVisibility();
  });

  window.addEventListener("cromaxEditorSessionChanged", () => {
    syncToolbarVisibility();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panelBackdrop && !panelBackdrop.hidden) {
      panelBackdrop.hidden = true;
      document.body.classList.remove("cromax-modal-open");
    }
  });
})();
