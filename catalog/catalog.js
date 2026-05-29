(function () {
  const root = document.querySelector("[data-catalog-root]");
  if (!root) return;

  function startCatalog() {
  const PAGE_SIZE = 10;

  const isProductDetailPage = Boolean(document.querySelector("[data-product-root]"));

  /** Совпадает с брейкпоинтом `.catalog-layout` в styles.css (одна колонка, сайдбар над списком). */
  function isCatalogMobileLayout() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 900px)").matches
    );
  }

  function catalogMainPageDefaultAccordionState() {
    if (isCatalogMobileLayout()) {
      return { category: false, application: false, paint: false, mixing: false };
    }
    return { category: true, application: false, paint: false, mixing: false };
  }

  /** Всегда актуальный список: тяжёлый catalog-products-data.js может выполниться после первого тика. */
  function catalogProducts() {
    const raw = window.CATALOG_PRODUCTS;
    return Array.isArray(raw) ? raw : [];
  }

  function catalogCategories() {
    const raw = window.CATALOG_CATEGORIES;
    return Array.isArray(raw) ? raw : [];
  }

  const displayText =
    typeof window.normalizeCatalogDisplayText === "function"
      ? window.normalizeCatalogDisplayText.bind(window)
      : (s) => s;

  function productCategorySlug(p) {
    return p && p.category != null ? String(p.category).trim() : "";
  }

  const filtersEl = root.querySelector("[data-catalog-filters]");
  const listEl = root.querySelector("[data-catalog-list]");
  const pagEl = root.querySelector("[data-catalog-pagination]");
  const clearBtn = root.querySelector("[data-catalog-clear]");
  const breadcrumbCategoryEl = document.querySelector("[data-catalog-breadcrumb-category]");
  const pageTitleEl = document.querySelector("[data-catalog-page-title]");

  /** Пустая строка — пункт «Все»: без фильтра по категории. */
  let selectedCategory = "";

  function selectedCategoryLabel() {
    if (!selectedCategory) return "Все";
    const cat = catalogCategories().find((c) => c.slug === selectedCategory);
    return cat ? cat.label : selectedCategory;
  }

  function syncBreadcrumbCategory() {
    if (breadcrumbCategoryEl) {
      breadcrumbCategoryEl.textContent = selectedCategoryLabel();
    }
  }

  function syncPageTitle() {
    if (pageTitleEl) {
      pageTitleEl.textContent = selectedCategory ? selectedCategoryLabel() : "Каталог товаров";
    }
  }
  let selectedApplication = "";
  let selectedPaintSystem = "";
  let selectedMixing = "";

  let page = 1;

  let accordionState = isProductDetailPage
    ? { category: false, application: false, paint: false, mixing: false }
    : catalogMainPageDefaultAccordionState();

  function productPaintSystem(p) {
    return p.paintSystem || "Universal System";
  }

  function euSsrFacets() {
    const m = window.CATALOG_EUSSR_FILTER_SKUS;
    return m && typeof m === "object" ? m : null;
  }

  /** EU `ref_usage_area` → ключ в `usageAreaEnglish` фасета. */
  function resolveUsageEuEnglishKey(ruLabel) {
    if (ruLabel == null || ruLabel === "") return null;
    const t = String(ruLabel).trim();
    const pass = window.CATALOG_APPLICATION_PASSENGER_CARS;
    const comm = window.CATALOG_APPLICATION_COMMERCIAL_VEHICLE;
    const ind = window.CATALOG_APPLICATION_INDUSTRIAL;
    if (pass != null && t === String(pass).trim()) return "Passenger Cars";
    if (comm != null && t === String(comm).trim()) return "Commercial Vehicles";
    if (ind != null && t === String(ind).trim()) return "Light Industry";
    return null;
  }

  function euSsrUsageSkuList(applicationRuLabel) {
    const facet = euSsrFacets();
    if (facet?.usageAreaRussian && applicationRuLabel != null) {
      const byRu = facet.usageAreaRussian[applicationRuLabel];
      if (Array.isArray(byRu)) return byRu;
    }
    const en = resolveUsageEuEnglishKey(applicationRuLabel);
    if (!en || !facet?.usageAreaEnglish) return null;
    const byEn = facet.usageAreaEnglish[en];
    return Array.isArray(byEn) ? byEn : null;
  }

  function euSsrPaintSkuList(paintLabel) {
    const arr = euSsrFacets()?.paintSystems?.[paintLabel];
    return Array.isArray(arr) ? arr : null;
  }

  function euSsrMixSkuList(mixingLabel) {
    const arr = euSsrFacets()?.mixingSystems?.[mixingLabel];
    return Array.isArray(arr) ? arr : null;
  }

  function productMatchesApplicationFilter(p, applicationValue) {
    if (!applicationValue) return true;
    const skuList = euSsrUsageSkuList(applicationValue);
    if (skuList) return skuList.includes(String(p.sku));
    return p.application === applicationValue;
  }

  function productMatchesPaintSystemFilter(p, paintValue) {
    if (!paintValue) return true;
    const skuList = euSsrPaintSkuList(paintValue);
    if (skuList) return skuList.includes(String(p.sku));
    return productPaintSystem(p) === paintValue;
  }

  function productMatchesMixingFilter(p, mixingValue) {
    if (!mixingValue) return true;
    const skuList = euSsrMixSkuList(mixingValue);
    if (skuList) return skuList.includes(String(p.sku));
    return p.mixingSystem === mixingValue;
  }

  function initFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("category");
    const cats = catalogCategories();
    if (cat && cats.some((c) => c.slug === cat)) {
      selectedCategory = cat;
    } else {
      selectedCategory = "";
    }
    const pageParam = parseInt(params.get("page"), 10);
    if (Number.isFinite(pageParam) && pageParam >= 1) {
      page = pageParam;
    }
    const appParam = params.get("application");
    if (appParam) {
      const apps = uniqueApplications();
      if (apps.includes(appParam)) selectedApplication = appParam;
    }
    const paintParam = params.get("paint");
    if (paintParam && uniquePaintSystems().includes(paintParam)) {
      selectedPaintSystem = paintParam;
    }
    const mixParam = params.get("mixing");
    if (mixParam && uniqueMixing().includes(mixParam)) {
      selectedMixing = mixParam;
    }
  }

  /** Только официальные три области как на EU-сайте; без подмешивания `product.application` (в JSON бывает некорректная кодировка). */
  function uniqueApplications() {
    const fromMeta = [
      window.CATALOG_APPLICATION_PASSENGER_CARS,
      window.CATALOG_APPLICATION_COMMERCIAL_VEHICLE,
      window.CATALOG_APPLICATION_INDUSTRIAL,
    ]
      .filter((x) => x != null && String(x).trim() !== "" && String(x) !== "—")
      .map((x) => String(x).trim());
    if (fromMeta.length > 0) {
      return [...new Set(fromMeta)].sort((a, b) => a.localeCompare(b, "ru"));
    }
    const facet = euSsrFacets();
    if (facet?.usageAreaRussian) {
      return Object.keys(facet.usageAreaRussian).sort((a, b) => a.localeCompare(b, "ru"));
    }
    const s = new Set();
    catalogProducts().forEach((p) => {
      if (p.application && p.application !== "—") s.add(p.application);
    });
    return [...s].sort((a, b) => a.localeCompare(b, "ru"));
  }

  function uniquePaintSystems() {
    const s = new Set();
    catalogProducts().forEach((p) => {
      s.add(productPaintSystem(p));
    });
    const facet = euSsrFacets();
    if (facet?.paintSystems) {
      Object.keys(facet.paintSystems).forEach((k) => s.add(k));
    }
    return [...s].sort((a, b) => a.localeCompare(b, "ru"));
  }

  function uniqueMixing() {
    const s = new Set();
    catalogProducts().forEach((p) => {
      if (p.mixingSystem && p.mixingSystem !== "—") s.add(p.mixingSystem);
    });
    const facet = euSsrFacets();
    if (facet?.mixingSystems) {
      Object.keys(facet.mixingSystems).forEach((k) => s.add(k));
    }
    return [...s].sort((a, b) => a.localeCompare(b, "ru"));
  }

  function matchesFilters(p) {
    if (selectedCategory && productCategorySlug(p) !== selectedCategory) return false;
    if (selectedApplication && !productMatchesApplicationFilter(p, selectedApplication)) return false;
    if (selectedPaintSystem && !productMatchesPaintSystemFilter(p, selectedPaintSystem)) return false;
    if (selectedMixing && !productMatchesMixingFilter(p, selectedMixing)) return false;
    return true;
  }

  function filtered() {
    return catalogProducts().filter(matchesFilters);
  }

  /**
   * @param {"category" | "application" | "paint" | "mixing"} exclude
   */
  function filteredExcluding(exclude) {
    return catalogProducts().filter((p) => {
      if (exclude !== "category" && selectedCategory && productCategorySlug(p) !== selectedCategory) return false;
      if (
        exclude !== "application" &&
        selectedApplication &&
        !productMatchesApplicationFilter(p, selectedApplication)
      )
        return false;
      if (exclude !== "paint" && selectedPaintSystem && !productMatchesPaintSystemFilter(p, selectedPaintSystem))
        return false;
      if (exclude !== "mixing" && selectedMixing && !productMatchesMixingFilter(p, selectedMixing))
        return false;
      return true;
    });
  }

  function syncUrl() {
    const params = new URLSearchParams(window.location.search);
    if (selectedCategory) {
      params.set("category", selectedCategory);
    } else {
      params.delete("category");
    }
    if (selectedApplication) {
      params.set("application", selectedApplication);
    } else {
      params.delete("application");
    }
    if (selectedPaintSystem) {
      params.set("paint", selectedPaintSystem);
    } else {
      params.delete("paint");
    }
    if (selectedMixing) {
      params.set("mixing", selectedMixing);
    } else {
      params.delete("mixing");
    }
    if (page > 1) {
      params.set("page", String(page));
    } else {
      params.delete("page");
    }
    const q = params.toString();
    const newUrl = `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", newUrl);
  }

  function buildCatalogIndexSearchParams() {
    const params = new URLSearchParams();
    if (selectedCategory) params.set("category", selectedCategory);
    if (selectedApplication) params.set("application", selectedApplication);
    if (selectedPaintSystem) params.set("paint", selectedPaintSystem);
    if (selectedMixing) params.set("mixing", selectedMixing);
    if (page > 1) params.set("page", String(page));
    return params;
  }

  function navigateToCatalogWithFilters() {
    const q = buildCatalogIndexSearchParams().toString();
    window.location.assign(`./index.html${q ? `?${q}` : ""}`);
  }

  function commitFilterChange() {
    if (isProductDetailPage) {
      navigateToCatalogWithFilters();
      return;
    }
    render();
  }

  /**
   * Текущее сужение по секции или null, если выбрано «Все» (в т.ч. категория — все позиции).
   * @param {"category" | "application" | "paint" | "mixing"} groupKey
   * @returns {string | null}
   */
  function accordionActiveSummary(groupKey) {
    if (groupKey === "category") {
      if (!selectedCategory) return null;
      const c = catalogCategories().find((x) => x.slug === selectedCategory);
      return c ? String(c.label) : selectedCategory || null;
    }
    if (groupKey === "application") {
      return selectedApplication ? displayText(selectedApplication) : null;
    }
    if (groupKey === "paint") {
      return selectedPaintSystem ? displayText(selectedPaintSystem) : null;
    }
    if (groupKey === "mixing") {
      return selectedMixing ? displayText(selectedMixing) : null;
    }
    return null;
  }

  function createAccordion(groupKey, titleText, buildPanel) {
    const acc = document.createElement("div");
    acc.className = "catalog-filter-accordion";
    const isOpen = Boolean(accordionState[groupKey]);
    if (isOpen) acc.classList.add("is-open");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "catalog-filter-accordion-trigger";
    trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");

    const icon = document.createElement("span");
    icon.className = "catalog-filter-accordion-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = isOpen ? "−" : "+";

    const titleSpan = document.createElement("span");
    titleSpan.className = "catalog-filter-accordion-title";
    titleSpan.textContent = titleText;

    const triggerBody = document.createElement("span");
    triggerBody.className = "catalog-filter-accordion-trigger-body";
    triggerBody.append(titleSpan);

    if (!isOpen) {
      const summaryText = accordionActiveSummary(groupKey);
      if (summaryText) {
        acc.classList.add("has-active-filter");
        const sumSpan = document.createElement("span");
        sumSpan.className = "catalog-filter-accordion-summary";
        sumSpan.textContent = summaryText;
        sumSpan.title = summaryText;
        triggerBody.append(sumSpan);
      }
    }

    trigger.append(icon, triggerBody);

    trigger.addEventListener("click", (e) => {
      if (isProductDetailPage && groupKey === "category" && !isOpen) {
        if (e.target.closest(".catalog-filter-accordion-summary")) {
          navigateToCatalogWithFilters();
          return;
        }
      }
      if (accordionState[groupKey]) {
        accordionState[groupKey] = false;
      } else {
        for (const k of Object.keys(accordionState)) {
          accordionState[k] = k === groupKey;
        }
      }
      render();
    });

    const panel = document.createElement("div");
    panel.className = "catalog-filter-accordion-panel";
    panel.hidden = !isOpen;
    buildPanel(panel);

    acc.append(trigger, panel);
    return acc;
  }

  /**
   * @param {string} radioName — уникальное name группы
   * @param {string} currentValue — выбранное значение или ""
   * @param {(val: string) => void} onPick
   */
  /**
   * @param {{ omitCount?: boolean, textOnlyRadio?: boolean }} [rowOpts]
   */
  function appendRadioRow(list, radioName, id, value, labelText, count, currentValue, onPick, rowOpts) {
    rowOpts = rowOpts || {};
    const wrap = document.createElement("label");
    wrap.className = "catalog-checkbox catalog-filter-radio";
    if (rowOpts.textOnlyRadio) {
      wrap.classList.add("catalog-filter-radio--text-only");
    }
    const input = document.createElement("input");
    input.type = "radio";
    input.name = radioName;
    input.value = value;
    input.id = id;
    input.checked = currentValue === value;
    input.addEventListener("change", () => {
      if (input.checked) onPick(value);
    });
    const span = document.createElement("span");
    span.className = "catalog-filter-radio-label";
    span.append(document.createTextNode(displayText(labelText)));
    if (!rowOpts.omitCount) {
      span.append(document.createTextNode(" "));
      const cntEl = document.createElement("span");
      cntEl.className = "catalog-filter-count";
      cntEl.textContent = `(${count})`;
      span.append(cntEl);
    }
    wrap.append(input, span);
    if (isProductDetailPage && radioName === "catalog-filter-category") {
      let wasChecked = false;
      wrap.addEventListener(
        "pointerdown",
        () => {
          wasChecked = input.checked;
        },
        true
      );
      wrap.addEventListener("click", () => {
        if (wasChecked && input.checked && String(selectedCategory) === String(value)) {
          navigateToCatalogWithFilters();
        }
      });
    }
    list.append(wrap);
  }

  function renderFilters() {
    if (!filtersEl) return;
    filtersEl.innerHTML = "";

    filtersEl.append(
      createAccordion("category", "Категория", (panel) => {
        const catList = document.createElement("div");
        catList.className = "catalog-checkbox-list";
        const poolForCat = filteredExcluding("category");
        appendRadioRow(
          catList,
          "catalog-filter-category",
          "catalog-cat-all",
          "",
          "Все",
          poolForCat.length,
          selectedCategory,
          (val) => {
            selectedCategory = val;
            page = 1;
            commitFilterChange();
          },
          { textOnlyRadio: true }
        );
        catalogCategories().forEach((c) => {
          const count = poolForCat.filter((p) => productCategorySlug(p) === c.slug).length;
          appendRadioRow(
            catList,
            "catalog-filter-category",
            `catalog-cat-${c.slug}`,
            c.slug,
            c.label,
            count,
            selectedCategory,
            (val) => {
              selectedCategory = val;
              page = 1;
              commitFilterChange();
            },
            { textOnlyRadio: true }
          );
        });
        panel.append(catList);
      })
    );

    const apps = uniqueApplications();
    if (apps.length) {
      filtersEl.append(
        createAccordion("application", "Область применения", (panel) => {
          const list = document.createElement("div");
          list.className = "catalog-checkbox-list";
          const pool = filteredExcluding("application");
          appendRadioRow(
            list,
            "catalog-filter-application",
            "catalog-app-all",
            "",
            "Все",
            pool.length,
            selectedApplication,
            (val) => {
              selectedApplication = val;
              page = 1;
              commitFilterChange();
            },
            { textOnlyRadio: true }
          );
          apps.forEach((a) => {
            const n = pool.filter((p) => productMatchesApplicationFilter(p, a)).length;
            const id = `catalog-app-${a.replace(/\s+/g, "-").slice(0, 40)}`;
            appendRadioRow(list, "catalog-filter-application", id, a, a, n, selectedApplication, (val) => {
              selectedApplication = val;
              page = 1;
              commitFilterChange();
            }, { textOnlyRadio: true });
          });
          panel.append(list);
        })
      );
    }

    const paints = uniquePaintSystems();
    if (paints.length) {
      filtersEl.append(
        createAccordion("paint", "Связанная ЛК-система", (panel) => {
          const list = document.createElement("div");
          list.className = "catalog-checkbox-list";
          const pool = filteredExcluding("paint");
          appendRadioRow(
            list,
            "catalog-filter-paint",
            "catalog-paint-all",
            "",
            "Все",
            pool.length,
            selectedPaintSystem,
            (val) => {
              selectedPaintSystem = val;
              page = 1;
              commitFilterChange();
            },
            { textOnlyRadio: true }
          );
          paints.forEach((paintName) => {
            const n = pool.filter((p) => productMatchesPaintSystemFilter(p, paintName)).length;
            const safeId = paintName.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 48);
            appendRadioRow(
              list,
              "catalog-filter-paint",
              `catalog-paint-${safeId}`,
              paintName,
              paintName,
              n,
              selectedPaintSystem,
              (val) => {
                selectedPaintSystem = val;
                page = 1;
                commitFilterChange();
              },
              { textOnlyRadio: true }
            );
          });
          panel.append(list);
        })
      );
    }

    const mix = uniqueMixing();
    if (mix.length) {
      filtersEl.append(
        createAccordion("mixing", "Смесительная система", (panel) => {
          const list = document.createElement("div");
          list.className = "catalog-checkbox-list";
          const pool = filteredExcluding("mixing");
          appendRadioRow(
            list,
            "catalog-filter-mixing",
            "catalog-mix-all",
            "",
            "Все",
            pool.length,
            selectedMixing,
            (val) => {
              selectedMixing = val;
              page = 1;
              commitFilterChange();
            },
            { textOnlyRadio: true }
          );
          mix.forEach((m) => {
            const n = pool.filter((p) => productMatchesMixingFilter(p, m)).length;
            const safeId = m.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 48);
            appendRadioRow(list, "catalog-filter-mixing", `catalog-mix-${safeId}`, m, m, n, selectedMixing, (val) => {
              selectedMixing = val;
              page = 1;
              commitFilterChange();
            }, { textOnlyRadio: true });
          });
          panel.append(list);
        })
      );
    }
  }

  function renderList(items) {
    if (!listEl) return;
    const start = (page - 1) * PAGE_SIZE;
    const slice = items.slice(start, start + PAGE_SIZE);
    listEl.innerHTML = "";
    if (!slice.length) {
      const p = document.createElement("p");
      p.className = "catalog-empty";
      p.textContent = "По выбранным фильтрам позиций не найдено.";
      listEl.append(p);
      return;
    }
    slice.forEach((prod) => {
      const row = document.createElement("article");
      row.className = "catalog-product-row";

      const inner = document.createElement("div");
      inner.className = "catalog-product-inner";

      const textCol = document.createElement("div");
      textCol.className = "catalog-product-text";

      const title = document.createElement("h3");
      title.className = "catalog-product-title";
      const nameText = displayText(prod.name);
      if (prod.sku) {
        const titleLink = document.createElement("a");
        titleLink.className = "catalog-product-title-link";
        titleLink.href = `./product.html?sku=${encodeURIComponent(prod.sku)}`;
        titleLink.textContent = nameText;
        title.append(titleLink);
      } else {
        title.textContent = nameText;
      }

      const meta = document.createElement("div");
      meta.className = "catalog-product-meta";

      const refLab = document.createElement("span");
      refLab.className = "catalog-product-label";
      refLab.textContent = "Артикул:";
      const refVal = document.createElement("span");
      refVal.className = "catalog-product-value";
      refVal.textContent = prod.articleRef ? String(prod.articleRef) : "—";

      const skuLab = document.createElement("span");
      skuLab.className = "catalog-product-label";
      skuLab.textContent = "Код материала:";
      const skuVal = document.createElement("span");
      skuVal.className = "catalog-product-value";
      skuVal.textContent = prod.sku ? String(prod.sku) : "—";

      meta.append(refLab, refVal, skuLab, skuVal);

      textCol.append(title, meta);

      if (prod.sku) {
        const link = document.createElement("a");
        link.className = "catalog-product-link";
        link.href = `./product.html?sku=${encodeURIComponent(prod.sku)}`;
        link.textContent = "+ Ссылка на страницу товара";
        textCol.append(link);
      }

      const media = document.createElement("div");
      media.className = "catalog-product-media";
      const productHref = prod.sku ? `./product.html?sku=${encodeURIComponent(prod.sku)}` : "";

      function appendMediaBody(node, ariaLabel) {
        if (productHref) {
          const mediaLink = document.createElement("a");
          mediaLink.className = "catalog-product-media-link";
          mediaLink.href = productHref;
          if (ariaLabel) mediaLink.setAttribute("aria-label", ariaLabel);
          mediaLink.append(node);
          media.append(mediaLink);
        } else {
          media.append(node);
        }
      }

      if (prod.image) {
        const img = document.createElement("img");
        img.className = "catalog-product-img";
        img.src = prod.image;
        img.alt = productHref ? nameText : "";
        img.loading = "lazy";
        img.decoding = "async";
        appendMediaBody(img);
      } else {
        const ph = document.createElement("span");
        ph.className = "catalog-product-thumb-placeholder";
        ph.setAttribute("aria-hidden", "true");
        appendMediaBody(
          ph,
          productHref ? `Страница товара: ${nameText}` : ""
        );
      }

      inner.append(textCol, media);
      row.append(inner);
      listEl.append(row);
    });
  }

  /**
   * Номера страниц и разрывы («…»), как в компактных пагинаторах: не рендерим 50+ кнопок.
   * @returns {(number | null)[]} null = многоточие
   */
  function paginationSequence(current, total) {
    if (total <= 1) return [];
    const delta = 2;
    const set = new Set([1, total]);
    for (let i = current - delta; i <= current + delta; i += 1) {
      if (i >= 1 && i <= total) set.add(i);
    }
    const sorted = [...set].sort((a, b) => a - b);
    const out = [];
    let prev = 0;
    for (const n of sorted) {
      if (prev && n - prev > 1) out.push(null);
      out.push(n);
      prev = n;
    }
    return out;
  }

  function goToPage(nextPage) {
    page = nextPage;
    render();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /**
   * Ссылка в пагинации (ul.paging > li > a).
   * @param {{ innerHTML?: string, linkClass?: string }} [opts]
   */
  function appendPagingLink(li, label, ariaLabel, onActivate, isDisabled, opts) {
    const a = document.createElement("a");
    a.href = "#";
    if (opts && opts.innerHTML) {
      a.innerHTML = opts.innerHTML;
    } else {
      a.textContent = label;
    }
    if (opts && opts.linkClass) {
      a.className = opts.linkClass;
    }
    if (ariaLabel) a.setAttribute("aria-label", ariaLabel);
    if (isDisabled) {
      a.setAttribute("aria-disabled", "true");
      a.setAttribute("tabindex", "-1");
    }
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (isDisabled) return;
      onActivate();
    });
    li.append(a);
  }

  function renderPagination(total) {
    if (!pagEl) return;
    pagEl.innerHTML = "";
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (pages <= 1) return;

    const ul = document.createElement("ul");
    ul.className = "paging";

    const liPrev = document.createElement("li");
    liPrev.className = "prev";
    if (page <= 1) liPrev.classList.add("disabled");
    appendPagingLink(
      liPrev,
      "",
      "Предыдущая страница",
      () => goToPage(page - 1),
      page <= 1,
      {
        innerHTML:
          '<i class="fa-solid fa-angle-left" aria-hidden="true"></i>',
        linkClass: "paging-nav",
      }
    );
    ul.append(liPrev);

    paginationSequence(page, pages).forEach((item) => {
      if (item === null) {
        const liGap = document.createElement("li");
        liGap.className = "paging-gap";
        const span = document.createElement("span");
        span.className = "paging-ell";
        span.textContent = "…";
        span.setAttribute("aria-hidden", "true");
        liGap.append(span);
        ul.append(liGap);
        return;
      }
      const liNum = document.createElement("li");
      if (item === page) {
        liNum.classList.add("active");
        const cur = document.createElement("span");
        cur.className = "paging-current";
        cur.textContent = String(item);
        cur.setAttribute("aria-current", "page");
        liNum.append(cur);
      } else {
        appendPagingLink(
          liNum,
          String(item),
          `Страница ${item}`,
          () => goToPage(item),
          false
        );
      }
      ul.append(liNum);
    });

    const liNext = document.createElement("li");
    liNext.className = "next";
    if (page >= pages) liNext.classList.add("disabled");
    appendPagingLink(
      liNext,
      "",
      "Следующая страница",
      () => goToPage(page + 1),
      page >= pages,
      {
        innerHTML:
          '<i class="fa-solid fa-angle-right" aria-hidden="true"></i>',
        linkClass: "paging-nav",
      }
    );
    ul.append(liNext);

    const nav = document.createElement("nav");
    nav.className = "catalog-pager";
    nav.setAttribute("aria-label", "Страницы результатов");
    nav.append(ul);
    pagEl.append(nav);
  }

  function render() {
    syncBreadcrumbCategory();
    syncPageTitle();
    renderFilters();
    const items = filtered();
    const maxPage = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    if (page > maxPage) page = maxPage;

    renderList(items);
    renderPagination(items.length);
    syncUrl();
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      selectedCategory = "";
      selectedApplication = "";
      selectedPaintSystem = "";
      selectedMixing = "";
      page = 1;
      accordionState = isProductDetailPage
        ? { category: false, application: false, paint: false, mixing: false }
        : catalogMainPageDefaultAccordionState();
      if (isProductDetailPage) {
        navigateToCatalogWithFilters();
      } else {
        render();
      }
    });
  }

  initFromUrl();
  if (!isProductDetailPage && selectedApplication) {
    accordionState = { category: false, application: true, paint: false, mixing: false };
  }
  render();
  }

  if (window.__CROMAX_OVERRIDES_APPLIED) startCatalog();
  else window.addEventListener("cromaxOverridesMerged", startCatalog, { once: true });
})();
