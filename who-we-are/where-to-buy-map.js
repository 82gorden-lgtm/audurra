(function () {
  "use strict";
  var root = document.querySelector("[data-cromax-where-buy-map]");
  if (!root) return;

  function apiHref(name) {
    if (typeof window.getCromaxApiBase !== "function") return "";
    try {
      return new URL(name, window.getCromaxApiBase()).href;
    } catch (_) {
      return "";
    }
  }

  function pageHref(rel) {
    try {
      return new URL(rel, window.location.href).href;
    } catch (_) {
      return "";
    }
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  var SALE_UI = {
    wholesale:
      "\u041e\u043f\u0442\u043e\u0432\u044b\u0439 \u043f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043b\u044c",
    retail:
      "\u0420\u043e\u0437\u043d\u0438\u0447\u043d\u044b\u0439 \u043f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043b\u044c",
    wholesale_retail: "\u041e\u043f\u0442 \u0438 \u0440\u043e\u0437\u043d\u0438\u0446\u0430",
  };

  var S = {
    titles: {},
    data: { version: 1, byRegionId: {} },
    draft: null,
    editShow: "",
    browse: "",
    paths: [],
    zoomSuppressUntil: 0,
    sortedRegionIds: [],
    regionSearchWired: false,
    editRegionComboWired: false,
    csrfToken: "",
    dealersSaveBusy: false,
  };

  function zoomClickBlocked() {
    return Date.now() < S.zoomSuppressUntil;
  }

  function q(sel) {
    return root.querySelector(sel);
  }

  var E = {
    ph: q("#whereBuyDealersPanelHeading"),
    pl: q("#whereBuyDealersPanelLive"),
    bs: q("#whereBuyRegionSelect"),
    srch: q("#whereBuyRegionSearch"),
    rlist: q("#whereBuyRegionListbox"),
    sg: q("#whereBuySvgMount"),
    tb: q("#whereBuyEditorToolbar"),
    bo: q("#whereBuyEditorOpen"),
    bd: q("#whereBuyEditorBackdrop"),
    bc: q("#whereBuyEditorCancel"),
    bsav: q("#whereBuyEditorSave"),
    bad: q("#whereBuyEditorAdd"),
    esr: q("#whereBuyEditRegion"),
    esrch: q("#whereBuyEditRegionSearch"),
    erlist: q("#whereBuyEditRegionListbox"),
    el: q("#whereBuyEditList"),
    ee: q("#whereBuyEditError"),
    hint: q("#whereBuyEditorAuthHint"),
  };

  function rowsFor(rid, src) {
    var by = src && src.byRegionId ? src.byRegionId : {};
    var xs = rid ? by[rid] : null;
    return Array.isArray(xs) ? xs : [];
  }

  function cloneDoc(x) {
    try {
      return JSON.parse(JSON.stringify(x || { version: 1, byRegionId: {} }));
    } catch (_) {
      return { version: 1, byRegionId: {} };
    }
  }

  function titleRu(rid) {
    if (!rid) return "";
    if (S.titles[rid]) return S.titles[rid];
    if (!E.sg) return rid;
    var p = E.sg.querySelector(
      '[data-region-id="' +
        String(rid).replace(/\\/g, "\\\\").replace(/"/g, '\\"') +
        '"]'
    );
    return p && p.dataset && p.dataset.regionLabel ? String(p.dataset.regionLabel) : rid;
  }

  function hoverHintEl() {
    return q("#whereBuyRegionHoverHint");
  }

  function hideRegionHoverHint() {
    var el = hoverHintEl();
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
    el.style.visibility = "";
    el.style.left = "";
    el.style.top = "";
    el.style.position = "";
    el.style.transform = "";
    el.setAttribute("aria-hidden", "true");
  }

  function positionHoverHintNearPointer(e, hint) {
    if (!hint || !e || typeof e.clientX !== "number") return;
    hint.style.position = "fixed";
    hint.style.visibility = "hidden";
    hint.style.transform = "";
    hint.style.left = "0";
    hint.style.top = "0";
    requestAnimationFrame(function () {
      if (hint.hidden) return;
      var br = hint.getBoundingClientRect();
      var pad = 12;
      var x = e.clientX + pad;
      var y = e.clientY + pad;
      if (x + br.width > window.innerWidth - 8) x = e.clientX - br.width - pad;
      if (y + br.height > window.innerHeight - 8) y = e.clientY - br.height - pad;
      if (x < 8) x = 8;
      if (y < 8) y = 8;
      hint.style.left = x + "px";
      hint.style.top = y + "px";
      hint.style.visibility = "visible";
    });
  }

  function positionHoverHintNearPath(pa, hint) {
    if (!hint || !pa || typeof pa.getBoundingClientRect !== "function") return;
    hint.style.position = "fixed";
    hint.style.visibility = "hidden";
    hint.style.transform = "";
    hint.style.left = "0";
    hint.style.top = "0";
    requestAnimationFrame(function () {
      if (hint.hidden) return;
      var geo = pa.getBoundingClientRect();
      var br = hint.getBoundingClientRect();
      var cx = geo.left + geo.width / 2;
      var x = cx - br.width / 2;
      var y = geo.top - br.height - 8;
      if (y < 8) y = geo.bottom + 8;
      if (x + br.width > window.innerWidth - 8) x = window.innerWidth - br.width - 8;
      if (x < 8) x = 8;
      if (y + br.height > window.innerHeight - 8) y = window.innerHeight - br.height - 8;
      hint.style.left = x + "px";
      hint.style.top = y + "px";
      hint.style.visibility = "visible";
    });
  }

  function showRegionHoverHint(rid, eOrNull, paForFocus) {
    var hint = hoverHintEl();
    if (!hint) return;
    var t = titleRu(rid);
    if (!t) return;
    hint.textContent = t;
    hint.hidden = false;
    hint.setAttribute("aria-hidden", "false");
    if (eOrNull && typeof eOrNull.clientX === "number") {
      positionHoverHintNearPointer(eOrNull, hint);
    } else if (paForFocus) {
      positionHoverHintNearPath(paForFocus, hint);
    }
  }

  function hl(k, rid) {
    var i = 0;
    for (; i < S.paths.length; i++) {
      var pa = S.paths[i];
      var pid = pa.getAttribute ? pa.getAttribute("data-region-id") : "";
      pa.classList.toggle(k, !!(rid && pid === rid));
    }
  }

  function normRegionQuery(s) {
    return String(s || "").trim().toLocaleLowerCase("ru-RU");
  }

  function ensureSortedRegionIds() {
    if (S.sortedRegionIds && S.sortedRegionIds.length) return;
    if (!S.titles || typeof S.titles !== "object") return;
    S.sortedRegionIds = Object.keys(S.titles).sort(function (a, b) {
      return S.titles[a].localeCompare(S.titles[b], "ru");
    });
  }

  function filterRegionIdsForSearch(query) {
    ensureSortedRegionIds();
    var nq = normRegionQuery(query);
    var ids = S.sortedRegionIds;
    if (!ids || !ids.length) return [];
    if (!nq.length) return ids.slice();
    return ids.filter(function (id) {
      return normRegionQuery(S.titles[id]).startsWith(nq);
    });
  }

  function hideRegionSearchListUi() {
    if (E.rlist instanceof HTMLElement) {
      E.rlist.hidden = true;
      E.rlist.innerHTML = "";
    }
    if (E.srch instanceof HTMLElement) E.srch.setAttribute("aria-expanded", "false");
  }

  function dealersUnsetBodyHtml(contactsHref) {
    return (
      '<div class="where-to-buy-dealers-unset">' +
      '<p class="where-to-buy-dealers-unset-lead">\u0412 \u0434\u0430\u043d\u043d\u043e\u043c \u0440\u0435\u0433\u0438\u043e\u043d\u0435 \u043e\u0444\u0438\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439 \u043f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043b\u044c \u043d\u0435 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0451\u043d.</p>' +
      '<p class="where-to-buy-dealers-unset-hint">\u041c\u044b \u043f\u043e\u043c\u043e\u0436\u0435\u043c \u0441 \u043f\u0440\u0438\u043e\u0431\u0440\u0435\u0442\u0435\u043d\u0438\u0435\u043c \u043f\u0440\u043e\u0434\u0443\u043a\u0446\u0438\u0438 Cromax.</p>' +
      '<a class="btn btn-primary where-to-buy-dealers-contact-btn" href="' +
      esc(contactsHref) +
      '">\u0421\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f \u0441 \u043d\u0430\u043c\u0438</a>' +
      "</div>"
    );
  }

  function renderPanel() {
    if (!E.ph || !E.pl) return;
    var contactsUrl = pageHref("../contacts/contacts.html");
    var id = S.browse;
    if (!id) {
      E.ph.textContent =
        "\u0420\u0435\u0433\u0438\u043e\u043d \u0435\u0449\u0451 \u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d";
      E.pl.innerHTML = dealersUnsetBodyHtml(contactsUrl);
      return;
    }
    E.ph.textContent = titleRu(id);
    var rows = rowsFor(id, S.data);
    if (rows.length === 0) {
      E.pl.innerHTML = dealersUnsetBodyHtml(contactsUrl);
      return;
    }
    var html = "";
    var j = 0;
    for (; j < rows.length; j++) {
      var drow = rows[j];
      var st = SALE_UI[drow.saleType] || "";
      var tag = esc(drow.saleType || "retail");
      html +=
        '<article class="where-to-buy-dealer-card"><header class="where-to-buy-dealer-card-head">' +
        '<h3 class="where-to-buy-dealer-name">' +
        esc(
          drow.company ||
            "\u041f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043b\u044c"
        ) +
        '</h3><p class="where-to-buy-dealer-type where-to-buy-dealer-type--' +
        tag +
        '">' +
        esc(st || "\u2014") +
        "</p></header>";
      if (drow.address)
        html +=
          '<p class="where-to-buy-dealer-line"><span class="where-to-buy-dealer-muted">\u0410\u0434\u0440\u0435\u0441</span><br>' +
          esc(drow.address) +
          "</p>";
      if (Array.isArray(drow.phones) && drow.phones.length) {
        html +=
          '<p class="where-to-buy-dealer-line"><span class="where-to-buy-dealer-muted">\u0422\u0435\u043b\u0435\u0444\u043e\u043d\u044b</span><br>' +
          esc(drow.phones.join(", ")) +
          "</p>";
      }
      if (drow.email)
        html +=
          '<p class="where-to-buy-dealer-line"><a class="where-to-buy-dealer-link" href="mailto:' +
          encodeURIComponent(drow.email) +
          '">' +
          esc(drow.email) +
          "</a></p>";
      if (drow.website && String(drow.website).trim()) {
        var w = String(drow.website).trim();
        if (!/^https?:\/\//i.test(w)) {
          w = "http://" + w;
        }
        html +=
          '<p class="where-to-buy-dealer-line"><a class="where-to-buy-dealer-link-ext" href="' +
          esc(w) +
          "\" target=\"_blank\" rel=\"noopener noreferrer nofollow\">\u0421\u0430\u0439\u0442</a></p>";
      }
      html += "</article>";
    }
    E.pl.innerHTML = html;
    E.pl.querySelectorAll("a.where-to-buy-dealer-link-ext").forEach(function (a) {
      a.addEventListener("click", function (e) {
        if (typeof window.openExternalDisclaimer === "function") {
          e.preventDefault();
          window.openExternalDisclaimer(a.href, e);
        }
      });
    });
  }

  function setBrowse(rid, fromSel) {
    /* fromSel оставлен для совместимости вызовов */
    void fromSel;
    S.browse = rid || "";
    hl("is-selected", S.browse);
    if (E.bs instanceof HTMLSelectElement) E.bs.value = S.browse;
    if (E.srch instanceof HTMLInputElement)
      E.srch.value = S.browse ? titleRu(S.browse) : "";
    hideRegionSearchListUi();
    renderPanel();
  }

  function fillBrowseSelect() {
    if (!(E.bs instanceof HTMLSelectElement)) return;
    E.bs.innerHTML = "";
    var o0 = document.createElement("option");
    o0.value = "";
    o0.textContent =
      "\u2014 \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0435\u0433\u0438\u043e\u043d \u2014";
    E.bs.appendChild(o0);
    var ids = Object.keys(S.titles).sort(function (a, b) {
      return S.titles[a].localeCompare(S.titles[b], "ru");
    });
    S.sortedRegionIds = ids.slice();
    ids.forEach(function (id) {
      var o = document.createElement("option");
      o.value = id;
      o.textContent = S.titles[id];
      E.bs.appendChild(o);
    });
    if (E.bs.dataset && E.bs.dataset.cromaxWhereBuyBrowse !== "1") {
      E.bs.dataset.cromaxWhereBuyBrowse = "1";
      E.bs.addEventListener("change", function () {
        hl("is-hover", "");
        hideRegionHoverHint();
        setBrowse(E.bs instanceof HTMLSelectElement ? E.bs.value : "", true);
      });
    }
    initRegionSearchComboOnce();
  }

  /** Общее поле «регион + поиск по первым буквам»: карта страницы и модальное редактирование. */
  function wireRegionCombo(srchEl, listEl, selEl, optIdPrefix, onPick) {
    if (
      !(srchEl instanceof HTMLInputElement) ||
      !(listEl instanceof HTMLElement) ||
      !(selEl instanceof HTMLSelectElement) ||
      typeof onPick !== "function"
    )
      return;
    var blurTimer = null;
    var activeIdx = -1;

    function setExpanded(on) {
      srchEl.setAttribute("aria-expanded", on ? "true" : "false");
    }

    function highlightActive() {
      var items = listEl.querySelectorAll("[data-region-id]");
      var n = items.length;
      if (!n) return;
      if (activeIdx < 0) activeIdx = 0;
      if (activeIdx >= n) activeIdx = n - 1;
      var j = 0;
      for (; j < items.length; j++) {
        items[j].classList.toggle(
          "where-to-buy-region-option--active",
          j === activeIdx
        );
      }
      if (activeIdx >= 0 && activeIdx < items.length)
        srchEl.setAttribute("aria-activedescendant", items[activeIdx].id || "");
      else srchEl.removeAttribute("aria-activedescendant");
    }

    function renderList(filtered) {
      activeIdx = filtered.length ? 0 : -1;
      listEl.innerHTML = "";
      if (!filtered.length) {
        var liEmpty = document.createElement("li");
        liEmpty.className = "where-to-buy-region-list-empty";
        liEmpty.setAttribute("role", "presentation");
        liEmpty.textContent =
          "\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e";
        listEl.appendChild(liEmpty);
      } else {
        var i = 0;
        for (; i < filtered.length; i++) {
          var ridLoop = filtered[i];
          var li = document.createElement("li");
          li.setAttribute("role", "option");
          li.id = optIdPrefix + "_" + ridLoop;
          li.setAttribute("data-region-id", ridLoop);
          li.className = "where-to-buy-region-option";
          li.textContent = S.titles[ridLoop];
          li.addEventListener("mousedown", function (e) {
            e.preventDefault();
            if (blurTimer) {
              clearTimeout(blurTimer);
              blurTimer = null;
            }
            var ridClick = e.currentTarget.getAttribute("data-region-id") || "";
            if (!ridClick) return;
            selEl.value = ridClick;
            onPick(ridClick);
          });
          listEl.appendChild(li);
        }
      }
      highlightActive();
    }

    function openFiltered() {
      var filtered = filterRegionIdsForSearch(srchEl.value);
      renderList(filtered);
      listEl.hidden = false;
      setExpanded(true);
    }

    function scheduleClose() {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(function () {
        blurTimer = null;
        listEl.hidden = true;
        listEl.innerHTML = "";
        srchEl.removeAttribute("aria-activedescendant");
        setExpanded(false);
      }, 160);
    }

    srchEl.addEventListener("focus", function () {
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
      openFiltered();
    });

    srchEl.addEventListener("input", function () {
      openFiltered();
    });

    srchEl.addEventListener("blur", function () {
      scheduleClose();
    });

    srchEl.addEventListener("keydown", function (e) {
      var key = e.key;
      if (key === "Escape") {
        var wasOpen = !listEl.hidden;
        listEl.hidden = true;
        listEl.innerHTML = "";
        srchEl.removeAttribute("aria-activedescendant");
        setExpanded(false);
        if (wasOpen) {
          e.stopPropagation();
          e.preventDefault();
        }
        return;
      }
      if (key === "ArrowDown") {
        e.preventDefault();
        if (listEl.hidden) openFiltered();
        var itemsDn = listEl.querySelectorAll("[data-region-id]");
        if (!itemsDn.length) return;
        activeIdx =
          activeIdx < 0 ? 0 : Math.min(activeIdx + 1, itemsDn.length - 1);
        highlightActive();
        return;
      }
      if (key === "ArrowUp") {
        e.preventDefault();
        if (listEl.hidden) openFiltered();
        var itemsUp = listEl.querySelectorAll("[data-region-id]");
        if (!itemsUp.length) return;
        activeIdx =
          activeIdx <= 0 ? itemsUp.length - 1 : activeIdx - 1;
        highlightActive();
        return;
      }
      if (key === "Enter") {
        var itemsEn = listEl.querySelectorAll("[data-region-id]");
        if (!itemsEn.length) return;
        e.preventDefault();
        var ix = activeIdx >= 0 ? activeIdx : 0;
        var pk = itemsEn[ix];
        var rv = pk ? pk.getAttribute("data-region-id") || "" : "";
        if (!rv) return;
        selEl.value = rv;
        onPick(rv);
      }
    });
  }

  function initRegionSearchComboOnce() {
    if (S.regionSearchWired) return;
    if (
      !(E.srch instanceof HTMLInputElement) ||
      !(E.rlist instanceof HTMLElement) ||
      !(E.bs instanceof HTMLSelectElement)
    )
      return;
    wireRegionCombo(E.srch, E.rlist, E.bs, "whereBuyRnOpt", function (rid) {
      setBrowse(rid, true);
    });
    S.regionSearchWired = true;
  }

  function initEditorRegionSearchComboOnce() {
    if (S.editRegionComboWired) return;
    if (
      !(E.esrch instanceof HTMLInputElement) ||
      !(E.erlist instanceof HTMLElement) ||
      !(E.esr instanceof HTMLSelectElement)
    )
      return;
    wireRegionCombo(E.esrch, E.erlist, E.esr, "whereBuyEdOpt", function (rid) {
      editSwitchRegion(rid);
    });
    S.editRegionComboWired = true;
  }

  function clampPanNum(n, lo, hi) {
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  function initWhereBuyMapZoom() {
    var viewport = root.querySelector("#whereBuyMapViewport");
    var panLayer = root.querySelector("#whereBuyZoomPanLayer");
    var range = root.querySelector("#whereBuyZoomRange");
    var btnIn = root.querySelector("#whereBuyZoomIn");
    var btnOut = root.querySelector("#whereBuyZoomOut");
    if (!viewport || !panLayer || !(range instanceof HTMLInputElement) || !(E.sg instanceof HTMLElement)) {
      return;
    }

    var zs = { scale: 1, panX: 0, panY: 0 };

    function clampPanState() {
      var vw = viewport.clientWidth;
      var vh = viewport.clientHeight;
      var iw = panLayer.clientWidth || vw;
      var ih = panLayer.clientHeight || vh;
      var s = zs.scale;
      if (vw < 4 || vh < 4) return;
      if (s <= 1) {
        zs.scale = 1;
        zs.panX = 0;
        zs.panY = 0;
        return;
      }
      /* iw = ширина слоя после боковых inset в CSS — при масштабе базовая ширина контента; границы — как vw − iw*s */
      zs.panX = clampPanNum(zs.panX, vw - iw * s, 0);
      zs.panY = clampPanNum(zs.panY, vh - ih * s, 0);
    }

    function applyPanZoomUi() {
      clampPanState();
      panLayer.style.transform =
        "translate(" + zs.panX + "px," + zs.panY + "px) scale(" + zs.scale + ")";
      panLayer.style.transformOrigin = "0 0";
      var pr = Math.round(Math.min(350, Math.max(100, zs.scale * 100)));
      range.value = String(pr);
      range.setAttribute("aria-valuenow", String(pr));
      if (btnIn instanceof HTMLButtonElement) btnIn.disabled = pr >= 350;
      if (btnOut instanceof HTMLButtonElement) btnOut.disabled = pr <= 100;
      viewport.style.cursor = zs.scale > 1.005 ? "grab" : "";
    }

    function setPct(percRaw) {
      var p = percRaw;
      if (typeof p !== "number" || Number.isNaN(p)) return;
      if (p < 100) p = 100;
      if (p > 350) p = 350;
      zs.scale = p / 100;
      if (zs.scale <= 1.001) {
        zs.scale = 1;
        zs.panX = 0;
        zs.panY = 0;
      }
      clampPanState();
      applyPanZoomUi();
    }

    viewport.style.touchAction = "none";
    viewport.style.outline = "none";

    viewport.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        var dz = e.deltaY;
        if (e.deltaMode === 1) dz *= 16;
        var dir = dz < 0 ? 1 : -1;
        var mul = dir > 0 ? 1.065 : 0.938;
        zs.scale *= mul;
        if (zs.scale < 1) zs.scale = 1;
        if (zs.scale > 3) zs.scale = 3;
        if (zs.scale <= 1.001) {
          zs.scale = 1;
          zs.panX = 0;
          zs.panY = 0;
        }
        clampPanState();
        applyPanZoomUi();
      },
      { passive: false }
    );

    range.addEventListener("input", function () {
      setPct(Number(range.value));
    });

    if (btnIn)
      btnIn.addEventListener("click", function () {
        zs.scale = Math.min(3, zs.scale * 1.12);
        if (zs.scale <= 1.001) zs.panX = zs.panY = 0;
        clampPanState();
        applyPanZoomUi();
      });

    if (btnOut)
      btnOut.addEventListener("click", function () {
        zs.scale = Math.max(1, zs.scale / 1.12);
        if (zs.scale <= 1.001) {
          zs.scale = 1;
          zs.panX = zs.panY = 0;
        }
        clampPanState();
        applyPanZoomUi();
      });

    var panSession = false;
    var panDragging = false;
    var startedOnRegion = false;
    var dragMoved = false;
    var sx = 0;
    var sy = 0;
    var opx = 0;
    var opy = 0;

    viewport.addEventListener(
      "pointerdown",
      function (e) {
        if (zs.scale <= 1) return;
        if (e.button !== 0) return;
        panSession = true;
        panDragging = false;
        dragMoved = false;
        sx = e.clientX;
        sy = e.clientY;
        opx = zs.panX;
        opy = zs.panY;
        var t = e.target;
        startedOnRegion = !!(
          t &&
          typeof t.closest === "function" &&
          t.closest("[data-region-id]")
        );
        /* Вне контуров субъектов можно сразу тянуть карту. По региону —
           захват указателя только после порога (>6px): иначе клик по region страдал бы. */
        if (!startedOnRegion) {
          panDragging = true;
          try {
            viewport.setPointerCapture(e.pointerId);
          } catch (_) {}
          viewport.style.cursor = "grabbing";
        }
      },
      true
    );

    viewport.addEventListener(
      "pointermove",
      function (e) {
        if (!panSession) return;
        var dx = e.clientX - sx;
        var dy = e.clientY - sy;
        if (!panDragging) {
          if (!(startedOnRegion && dx * dx + dy * dy > 36)) return;
          panDragging = true;
          dragMoved = true;
          try {
            viewport.setPointerCapture(e.pointerId);
          } catch (_) {}
          viewport.style.cursor = "grabbing";
        }
        if (!dragMoved && dx * dx + dy * dy > 36) dragMoved = true;
        zs.panX = opx + dx;
        zs.panY = opy + dy;
        clampPanState();
        panLayer.style.transform =
          "translate(" + zs.panX + "px," + zs.panY + "px) scale(" + zs.scale + ")";
        panLayer.style.transformOrigin = "0 0";
      },
      true
    );

    function ptrEnd(e) {
      if (!panSession) return;
      panSession = false;
      if (!panDragging) return;
      panDragging = false;
      viewport.style.cursor = zs.scale > 1.005 ? "grab" : "";
      if (dragMoved) {
        S.zoomSuppressUntil = Date.now() + 450;
      }
      dragMoved = false;
      if (typeof e.pointerId === "number") {
        try {
          viewport.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    }

    viewport.addEventListener(
      "pointerup",
      function (e) {
        ptrEnd(e);
      },
      true
    );
    viewport.addEventListener(
      "pointercancel",
      function (e) {
        ptrEnd(e);
      },
      true
    );

    new ResizeObserver(function () {
      clampPanState();
      applyPanZoomUi();
    }).observe(viewport);

    applyPanZoomUi();
  }

  function wireSvgMount() {
    if (!E.sg) return;
    S.paths = [].slice.call(E.sg.querySelectorAll("[data-region-id]"));
    S.paths.forEach(function (pa) {
      var rid =
        typeof pa.getAttribute === "function"
          ? pa.getAttribute("data-region-id")
          : "";
      if (!rid) return;
      pa.addEventListener("mouseenter", function (e) {
        hl("is-hover", rid);
        showRegionHoverHint(rid, e);
      });
      pa.addEventListener("mousemove", function (e) {
        var hEl = hoverHintEl();
        if (!(hEl && !hEl.hidden)) return;
        positionHoverHintNearPointer(e, hEl);
      });
      pa.addEventListener("mouseleave", function () {
        hl("is-hover", "");
        hideRegionHoverHint();
      });
      pa.addEventListener("focus", function () {
        hl("is-hover", rid);
        showRegionHoverHint(rid, null, pa);
        pa.setAttribute("aria-describedby", "whereBuyRegionHoverHint");
      });
      pa.addEventListener("blur", function () {
        hl("is-hover", "");
        hideRegionHoverHint();
        pa.removeAttribute("aria-describedby");
      });
      pa.addEventListener("click", function (e) {
        if (zoomClickBlocked()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        hl("is-hover", "");
        hideRegionHoverHint();
        setBrowse(rid, false);
      });
      pa.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          if (zoomClickBlocked()) return;
          e.preventDefault();
          hl("is-hover", "");
          hideRegionHoverHint();
          setBrowse(rid, false);
        }
      });
      pa.style.cursor = "pointer";
      if (!pa.getAttribute("tabindex")) pa.setAttribute("tabindex", "0");
      if (!pa.getAttribute("role")) pa.setAttribute("role", "button");
    });
    var lw = E.sg.closest(".where-to-buy-map-svg-wrap");
    if (lw) {
      lw.classList.remove("where-to-buy-svg-loading");
      lw.removeAttribute("aria-busy");
    }
    var svgRoot = E.sg.querySelector(".where-to-buy-svg-root");
    if (svgRoot instanceof SVGSVGElement) {
      /* meet: сохранить весь viewBox (Калининград по левому краю не обрезается). slice при несходстве
         пропорций хоста срезает бока — из-за узкого слоя пана Калининград выпадал за клип */
      svgRoot.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svgRoot.style.display = "block";
      svgRoot.style.verticalAlign = "top";
      svgRoot.style.margin = "0";
      svgRoot.style.width = "100%";
      svgRoot.style.height = "100%";
      svgRoot.style.maxWidth = "none";
    }
    if (E.sg.closest("#whereBuyZoomPanLayer")) {
      initWhereBuyMapZoom();
      E.sg.style.touchAction = "none";
    } else {
      E.sg.style.touchAction = "manipulation";
    }
  }

  function editFlushDom() {
    var doc = S.draft;
    var rg = S.editShow;
    if (!(doc && doc.byRegionId && rg && E.el)) return;
    var arr = [];
    Array.prototype.slice.call(E.el.querySelectorAll(".wb-row")).forEach(function (fs) {
      var cn = fs.querySelector(".wb-co");
      var sa = fs.querySelector(".wb-sale");
      var ad = fs.querySelector(".wb-adr");
      var ph = fs.querySelector(".wb-ph");
      var em = fs.querySelector(".wb-em");
      var ws = fs.querySelector(".wb-ws");
      var sv = "retail";
      if (sa instanceof HTMLSelectElement) {
        if (
          sa.value === "wholesale" ||
          sa.value === "retail" ||
          sa.value === "wholesale_retail"
        ) {
          sv = sa.value;
        }
      }
      arr.push({
        saleType: sv,
        company: cn instanceof HTMLInputElement ? cn.value.trim() : "",
        address: ad instanceof HTMLTextAreaElement ? ad.value.trim() : "",
        phones: normalizedEditorPhone(ph),
        email: em instanceof HTMLInputElement ? em.value.trim() : "",
        website: ws instanceof HTMLInputElement ? ws.value.trim() : "",
      });
    });
    doc.byRegionId[rg] = arr;
  }

  function ruPhoneDigits(value) {
    var raw = String(value || "");
    var digits = raw.replace(/\D/g, "");
    if (/^\s*\+?\s*7/.test(raw) && digits.charAt(0) === "7") {
      digits = digits.slice(1);
    } else if (
      (digits.charAt(0) === "7" || digits.charAt(0) === "8") &&
      digits.length > 10
    ) {
      digits = digits.slice(1);
    }
    return digits.slice(0, 10);
  }

  function formatRuPhone(value) {
    var digits = ruPhoneDigits(value);
    return formatRuPhoneDigits(digits);
  }

  function formatRuPhoneDigits(digits) {
    digits = String(digits || "").slice(0, 10);
    var codeLen = ruPhoneAreaCodeLength(digits);
    var prefix = "+7";
    if (!digits) return prefix + " ";
    var out = "+7";
    out += " (" + digits.slice(0, codeLen);
    if (digits.length >= codeLen) out += ")";
    if (digits.length > codeLen) {
      var rest = digits.slice(codeLen);
      var firstPartLen = codeLen === 3 ? 3 : 2;
      out += " " + rest.slice(0, firstPartLen);
      if (rest.length > firstPartLen)
        out += "-" + rest.slice(firstPartLen, firstPartLen + 2);
      if (rest.length > firstPartLen + 2)
        out += "-" + rest.slice(firstPartLen + 2, firstPartLen + 4);
    }
    return out;
  }

  function ruPhoneAreaCodeLength(digits) {
    if (!digits) return 3;
    if (digits.charAt(0) === "9") return 3;
    if (
      digits.indexOf("495") === 0 ||
      digits.indexOf("499") === 0 ||
      digits.indexOf("812") === 0
    ) {
      return 3;
    }
    return digits.length > 3 ? 4 : 3;
  }

  function ruPhoneCursorByDigitCount(formatted, digitCount) {
    var count = Math.max(0, digitCount || 0);
    if (!count) return Math.min(3, formatted.length);
    var seen = 0;
    var skippedCountryCode = false;
    for (var i = 0; i < formatted.length; i++) {
      if (!/\d/.test(formatted.charAt(i))) continue;
      if (!skippedCountryCode) {
        skippedCountryCode = true;
        continue;
      }
      seen++;
      if (seen >= count) return i + 1;
    }
    return formatted.length;
  }

  function applyRuPhoneMask(input, keepCursor) {
    if (!(input instanceof HTMLInputElement)) return;
    var pos = input.selectionStart;
    var digitCountBeforeCursor =
      keepCursor && typeof pos === "number"
        ? ruPhoneDigits(input.value.slice(0, pos)).length
        : 10;
    var formatted = formatRuPhone(input.value);
    input.value = formatted;
    if (keepCursor && typeof input.setSelectionRange === "function") {
      var nextPos = ruPhoneCursorByDigitCount(formatted, digitCountBeforeCursor);
      input.setSelectionRange(nextPos, nextPos);
    }
  }

  function normalizedEditorPhone(node) {
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) {
      return [];
    }
    var formatted = formatRuPhone(node.value);
    return ruPhoneDigits(formatted).length === 10 ? [formatted] : [];
  }

  function wireRuPhoneMask(input) {
    if (!(input instanceof HTMLInputElement)) return;
    input.addEventListener("focus", function () {
      applyRuPhoneMask(input, false);
    });
    input.addEventListener("input", function () {
      applyRuPhoneMask(input, true);
    });
    input.addEventListener("blur", function () {
      applyRuPhoneMask(input, false);
    });
  }

  function editRenderRows() {
    if (!E.el || !S.draft) return;
    if (!S.editShow) {
      E.el.innerHTML = "";
      return;
    }
    E.el.innerHTML = "";
    var rows = rowsFor(S.editShow, S.draft);
    var k = 0;
    for (; k < rows.length; k++) {
      (function () {
        var row = rows[k];
        var idx = k;

        var fs = document.createElement("fieldset");
        fs.className = "wb-row";
        fs.dataset.i = String(idx);

        var leg = document.createElement("legend");
        leg.textContent =
          "\u041f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043b\u044c " +
          (idx + 1);
        fs.appendChild(leg);

        function addField(L, node) {
          var lab = document.createElement("label");
          lab.className = "cromax-field wb-field";
          var sp = document.createElement("span");
          sp.textContent = L;
          lab.appendChild(sp);
          lab.appendChild(node);
          fs.appendChild(lab);
        }

        var inpC = document.createElement("input");
        inpC.type = "text";
        inpC.className = "wb-co";
        inpC.value = row.company || "";

        var sel = document.createElement("select");
        sel.className = "wb-sale";
        ["wholesale", "retail", "wholesale_retail"].forEach(function (key) {
          var o = document.createElement("option");
          o.value = key;
          o.textContent = SALE_UI[key];
          sel.appendChild(o);
        });

        sel.value =
          row.saleType === "wholesale" ||
          row.saleType === "retail" ||
          row.saleType === "wholesale_retail"
            ? row.saleType
            : "retail";

        var taA = document.createElement("textarea");
        taA.className = "wb-adr";
        taA.rows = 2;
        taA.value = row.address || "";

        var inpP = document.createElement("input");
        inpP.type = "tel";
        inpP.className = "wb-ph";
        inpP.inputMode = "tel";
        inpP.maxLength = 18;
        inpP.placeholder = "+7 (495) 000-00-00";
        inpP.value =
          Array.isArray(row.phones) && row.phones.length
            ? formatRuPhone(row.phones[0])
            : formatRuPhone("");
        wireRuPhoneMask(inpP);

        var inpE = document.createElement("input");
        inpE.type = "email";
        inpE.className = "wb-em";
        inpE.value = row.email || "";

        var inpW = document.createElement("input");
        inpW.type = "url";
        inpW.className = "wb-ws";
        inpW.placeholder = "https://";
        inpW.value = row.website || "";

        addField(
          "\u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435",
          inpC
        );
        addField("\u0422\u0438\u043f", sel);
        addField("\u0410\u0434\u0440\u0435\u0441", taA);
        addField(
          "\u0422\u0435\u043b\u0435\u0444\u043e\u043d",
          inpP
        );
        addField("Email", inpE);
        addField("\u0421\u0430\u0439\u0442", inpW);

        var del = document.createElement("button");
        del.type = "button";
        del.className = "btn btn-ghost wb-del";
        del.textContent = "\u0423\u0434\u0430\u043b\u0438\u0442\u044c";
        del.addEventListener("click", function () {
          editFlushDom();
          var cur = rowsFor(S.editShow, S.draft).slice();
          cur.splice(idx, 1);
          S.draft.byRegionId[S.editShow] = cur;
          editRenderRows();
        });

        fs.appendChild(del);
        E.el.appendChild(fs);
      })();
    }
  }

  function editSwitchRegion(nextId) {
    editFlushDom();
    var raw = nextId ? String(nextId) : "";
    if (!(E.esr instanceof HTMLSelectElement)) return;
    var ok = [].slice.call(E.esr.options).some(function (o) {
      return o.value === raw;
    });
    if (!ok)
      raw = E.esr.options[0] ? E.esr.options[0].value : "";
    S.editShow = raw;
    E.esr.value = raw;
    if (E.esrch instanceof HTMLInputElement)
      E.esrch.value = raw ? titleRu(raw) : "";
    editRenderRows();
  }

  function editRegionDropdownChange() {
    if (!(E.esr instanceof HTMLSelectElement)) return;
    editSwitchRegion(E.esr.value);
  }

  function setEditErr(msg) {
    if (!E.ee) return;
    E.ee.hidden = !msg;
    E.ee.textContent = msg ? String(msg) : "";
  }

  function openEditor() {
    if (!(E.bd && E.el && E.esr instanceof HTMLSelectElement)) return;
    setDealerSaveUi(false);
    S.draft = cloneDoc(S.data);
    if (!(S.draft.byRegionId && typeof S.draft.byRegionId === "object")) {
      S.draft.byRegionId = {};
    }

    E.esr.innerHTML = "";
    var oEmp = document.createElement("option");
    oEmp.value = "";
    oEmp.textContent = "";
    E.esr.appendChild(oEmp);
    Object.keys(S.titles)
      .sort(function (a, b) {
        return S.titles[a].localeCompare(S.titles[b], "ru");
      })
      .forEach(function (id) {
        var o = document.createElement("option");
        o.value = id;
        o.textContent = S.titles[id];
        E.esr.appendChild(o);
      });

    var keysSorted = Object.keys(S.titles).sort(function (a, b) {
      return S.titles[a].localeCompare(S.titles[b], "ru");
    });
    S.editShow = S.browse || "";
    if (!S.editShow || keysSorted.indexOf(S.editShow) < 0) {
      S.editShow = "";
    }
    E.esr.value = S.editShow;

    initEditorRegionSearchComboOnce();
    if (E.esrch instanceof HTMLInputElement)
      E.esrch.value = S.editShow ? titleRu(S.editShow) : "";

    if (E.esr.dataset && E.esr.dataset.cromaxWhereBuyEditWire !== "1") {
      E.esr.dataset.cromaxWhereBuyEditWire = "1";
      E.esr.addEventListener("change", editRegionDropdownChange);
    }

    setEditErr("");
    editRenderRows();
    E.bd.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeEditor() {
    editFlushDom();
    S.draft = null;
    S.editShow = "";
    if (E.erlist instanceof HTMLElement) {
      E.erlist.hidden = true;
      E.erlist.innerHTML = "";
    }
    if (E.esrch instanceof HTMLElement) {
      E.esrch.removeAttribute("aria-activedescendant");
      E.esrch.setAttribute("aria-expanded", "false");
    }
    if (E.bd) E.bd.hidden = true;
    document.body.style.overflow = "";
  }

  function dealerSaveErrorMessage(code) {
    if (code === "unauthorized")
      return "\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u0432\u0445\u043e\u0434 \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440\u0430 (\u041c\u043e\u0439 Cromax).";
    if (code === "forbidden_capability")
      return "\u041d\u0435\u0442 \u043f\u0440\u0430\u0432 \u043d\u0430 \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u043a\u0430\u0440\u0442\u044b \u0434\u0438\u043b\u0435\u0440\u043e\u0432.";
    if (code === "csrf_failed")
      return "\u0421\u0435\u0441\u0441\u0438\u044f \u0437\u0430\u0449\u0438\u0442\u044b \u0438\u0441\u0442\u0435\u043a\u043b\u0430. \u041e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u0432\u0445\u043e\u0434.";
    if (code === "origin_mismatch")
      return "\u0417\u0430\u043f\u0440\u043e\u0441 \u043e\u0442\u043a\u043b\u043e\u043d\u0451\u043d \u043f\u043e \u043f\u0440\u0438\u0437\u043d\u0430\u043a\u0443 origin/referer.";
    if (code === "rate_limited")
      return "\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u043f\u043e\u043f\u044b\u0442\u043e\u043a \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f. \u041f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435 \u043c\u0438\u043d\u0443\u0442\u0443 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435.";
    if (code === "write_failed")
      return "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440 (\u043f\u0440\u0430\u0432\u0430 catalog/api/data).";
    if (code === "invalid_json")
      return "\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0444\u043e\u0440\u043c\u0430\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0445 \u0434\u0430\u043d\u043d\u044b\u0445.";
    if (typeof code === "string" && code) return code;
    return "";
  }

  function savedDealersDocFromResponse(x) {
    if (x && x.j && x.j.doc && typeof x.j.doc === "object") {
      var doc = cloneDoc(x.j.doc);
      if (!doc.byRegionId || typeof doc.byRegionId !== "object") {
        doc.byRegionId = {};
      }
      return doc;
    }
    return null;
  }

  /** Разбор JSON из тела ответа (до «{» иногда попадают notice/warnings от PHP). */
  function sliceFirstJsonObject(s) {
    if (!s || typeof s !== "string") return "";
    var i = s.indexOf("{");
    if (i < 0) return "";
    var depth = 0;
    var inStr = false;
    var esc = false;
    var k = i;
    for (; k < s.length; k++) {
      var ch = s.charAt(k);
      if (esc) {
        esc = false;
      } else if (inStr) {
        if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') {
        inStr = true;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) return s.slice(i, k + 1);
      }
    }
    return "";
  }

  function parseCromaxJsonFromText(text) {
    if (!text || typeof text !== "string") return null;
    var t = text.replace(/^\uFEFF/, "").trim();
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch (_) {}
    var slab = sliceFirstJsonObject(t);
    if (!slab) return null;
    try {
      return JSON.parse(slab);
    } catch (_) {
      return null;
    }
  }

  function reloadDealersFromServer() {
    var href = apiHref("read-dealers.php");
    if (!href) return Promise.resolve(null);
    try {
      var u = new URL(href, window.location.href);
      u.searchParams.set("_", String(Date.now()));
      href = u.href;
    } catch (_) {}
    return fetch(href, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(function (r) {
        return r.ok ? r.text() : "";
      })
      .then(function (txt) {
        var j = parseCromaxJsonFromText(txt);
        return j && typeof j === "object" ? j : null;
      })
      .catch(function () {
        return null;
      });
  }

  function setDealerSaveUi(busy) {
    S.dealersSaveBusy = busy;
    if (E.bsav instanceof HTMLElement) E.bsav.setAttribute("aria-busy", busy ? "true" : "false");
    if (E.bsav instanceof HTMLButtonElement) E.bsav.disabled = busy;
    if (E.bc instanceof HTMLButtonElement) E.bc.disabled = busy;
  }

  function normalizedDealerRowForCompare(row) {
    var sale =
      row && typeof row.saleType === "string" ? row.saleType.trim() : "";
    if (
      sale !== "wholesale" &&
      sale !== "retail" &&
      sale !== "wholesale_retail"
    ) {
      sale = "retail";
    }
    var phonesIn = row && Array.isArray(row.phones) ? row.phones : [];
    var phones = [];
    var i = 0;
    for (; i < phonesIn.length; i++) {
      if (typeof phonesIn[i] === "string" && phonesIn[i].trim() !== "") {
        phones.push(phonesIn[i].trim());
      }
    }
    return {
      saleType: sale,
      company:
        row && typeof row.company === "string" ? row.company.trim() : "",
      address:
        row && typeof row.address === "string" ? row.address.trim() : "",
      phones: phones,
      email: row && typeof row.email === "string" ? row.email.trim() : "",
      website:
        row && typeof row.website === "string" ? row.website.trim() : "",
    };
  }

  function comparableDealerRows(rows) {
    var src = Array.isArray(rows) ? rows : [];
    var out = [];
    var i = 0;
    for (; i < src.length; i++) {
      var row = normalizedDealerRowForCompare(src[i]);
      if (editorRowWouldBeKept(row)) out.push(row);
    }
    return out;
  }

  function dealerRowsMatch(a, b) {
    return JSON.stringify(comparableDealerRows(a)) === JSON.stringify(comparableDealerRows(b));
  }

  /** Соответствует catalog/api/bootstrap.php:cromax_normalize_dealers_document (пустые карточки отбрасываются). */
  function editorRowWouldBeKept(row) {
    if (!row || typeof row !== "object") return false;
    var company =
      typeof row.company === "string" ? row.company.trim() : "";
    var address =
      typeof row.address === "string" ? row.address.trim() : "";
    var email = typeof row.email === "string" ? row.email.trim() : "";
    var website =
      typeof row.website === "string" ? row.website.trim() : "";
    var phones = Array.isArray(row.phones) ? row.phones : [];
    var hasPhone = phones.some(function (p) {
      return typeof p === "string" && p.trim() !== "";
    });
    return (
      company !== "" ||
      address !== "" ||
      email !== "" ||
      website !== "" ||
      hasPhone
    );
  }

  function editorSave() {
    editFlushDom();
    if (!S.draft) {
      setEditErr("\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u0434\u043b\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f.");
      return;
    }
    if (!S.editShow) {
      setEditErr(
        "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0435\u0433\u0438\u043e\u043d \u0432 \u0444\u043e\u0440\u043c\u0435 \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f."
      );
      return;
    }
    var href = apiHref("save-dealers.php");
    if (!href) {
      setEditErr(
        "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c URL API. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435, \u0447\u0442\u043e \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0451\u043d cromax-site.js."
      );
      return;
    }
    if (!S.csrfToken) {
      setEditErr(
        "\u041d\u0435\u0442 CSRF-\u0442\u043e\u043a\u0435\u043d\u0430 \u0441\u0435\u0441\u0441\u0438\u0438. \u041e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 \u0438 \u0432\u043e\u0439\u0434\u0438\u0442\u0435 \u0441\u043d\u043e\u0432\u0430."
      );
      return;
    }
    var rowsCheck = rowsFor(S.editShow, S.draft);
    var empties = 0;
    var iCh = 0;
    for (; iCh < rowsCheck.length; iCh++) {
      if (!editorRowWouldBeKept(rowsCheck[iCh])) empties++;
    }
    if (empties > 0) {
      setEditErr(
        "\u041f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043b\u044e \u043d\u0443\u0436\u043d\u043e \u0437\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u043d\u043e \u0438\u0437 \u043f\u043e\u043b\u0435\u0439 (\u043d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435, \u0430\u0434\u0440\u0435\u0441, \u0442\u0435\u043b\u0435\u0444\u043e\u043d \u2014 \u043f\u043e\u043b\u043d\u043e\u0441\u0442\u044c\u044e 10 \u0446\u0438\u0444\u0440, email \u0438\u043b\u0438 \u0441\u0430\u0439\u0442) \u0438\u043b\u0438 \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u0443\u0441\u0442\u0443\u044e \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0443. \u041f\u0443\u0441\u0442\u044b\u0435 \u0437\u0430\u043f\u0438\u0441\u0438 \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440 \u043d\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u044e\u0442\u0441\u044f."
      );
      return;
    }
    if (S.dealersSaveBusy) return;
    setEditErr("");
    setDealerSaveUi(true);
    var savedRegionIdForUi = S.editShow;
    var expectedRowsForUi = comparableDealerRows(rowsFor(savedRegionIdForUi, S.draft));
    fetch(href, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Cromax-CSRF": S.csrfToken,
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
      body: JSON.stringify(S.draft),
    })
      .then(function (r) {
        return r.text().then(function (text) {
          var j = parseCromaxJsonFromText(text);
          return { okHttp: r.ok, status: r.status, j: j, raw: text };
        });
      })
      .then(function (x) {
        if (x.okHttp && x.j && x.j.ok === true) {
          var responseData = savedDealersDocFromResponse(x);
          if (
            !responseData ||
            !dealerRowsMatch(
              rowsFor(savedRegionIdForUi, responseData),
              expectedRowsForUi
            )
          ) {
            setEditErr(
              "\u0421\u0435\u0440\u0432\u0435\u0440 \u043e\u0442\u0432\u0435\u0442\u0438\u043b \u00ab\u0443\u0441\u043f\u0435\u0448\u043d\u043e\u00bb, \u043d\u043e \u043d\u0435 \u0432\u0435\u0440\u043d\u0443\u043b \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435 \u044d\u0442\u043e\u0433\u043e \u0440\u0435\u0433\u0438\u043e\u043d\u0430. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 catalog/api/save-dealers.php \u0438 catalog/api/data/dealers-ru.json."
            );
            return;
          }
          S.data = responseData;
          closeEditor();
          if (savedRegionIdForUi)
            setBrowse(savedRegionIdForUi, false);
          else renderPanel();
          return reloadDealersFromServer().then(function (fresh) {
            if (fresh && typeof fresh === "object") {
              if (!fresh.byRegionId || typeof fresh.byRegionId !== "object") {
                fresh.byRegionId = {};
              }
              if (
                dealerRowsMatch(
                  rowsFor(savedRegionIdForUi, fresh),
                  expectedRowsForUi
                )
              ) {
                S.data = cloneDoc(fresh);
                if (savedRegionIdForUi)
                  setBrowse(savedRegionIdForUi, false);
                else renderPanel();
              }
            }
          });
        }
        var code =
          x.j && typeof x.j.error === "string" ? x.j.error : "";
        var msg = dealerSaveErrorMessage(code);
        if (!msg && x.raw && x.raw.length < 400) {
          msg = x.raw;
        }
        if (!msg && x.j == null && x.raw) {
          msg =
            "\u041e\u0442\u0432\u0435\u0442 \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u043d\u0435 \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u043d \u043a\u0430\u043a JSON. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043b\u043e\u0433\u0438 PHP \u0438 \u0432\u044b\u0432\u043e\u0434 \u0434\u043e JSON \u0432 save-dealers.php.";
        }
        setEditErr(
          msg ||
            "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435 \u043d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c (HTTP " +
            (x.status || "?") +
            ")."
        );
      })
      .catch(function () {
        setEditErr(
          "\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0442\u0438 \u0438\u043b\u0438 \u043e\u0442\u0432\u0435\u0442 \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u043d\u0435 JSON."
        );
      })
      .then(function () {
        setDealerSaveUi(false);
      });
  }

  function addEditorRow() {
    editFlushDom();
    if (!(S.draft && S.editShow)) return;
    var cur = rowsFor(S.editShow, S.draft).slice();
    cur.push({
      saleType: "retail",
      company: "",
      address: "",
      phones: [],
      email: "",
      website: "",
    });
    S.draft.byRegionId[S.editShow] = cur;
    editRenderRows();
    requestAnimationFrame(function () {
      if (!E.el) return;
      var rows = E.el.querySelectorAll(".wb-row");
      var last = rows.length ? rows[rows.length - 1] : null;
      if (!last) return;
      if (typeof last.scrollIntoView === "function") {
        last.scrollIntoView({ block: "start", behavior: "smooth" });
      }
      var firstInput = last.querySelector(".wb-co");
      if (firstInput instanceof HTMLInputElement) firstInput.focus();
    });
  }

  function syncToolbar() {
    if (!E.tb) return;
    if (typeof window.fetchCromaxSession !== "function") {
      E.tb.hidden = true;
      S.csrfToken = "";
      return;
    }
    window.fetchCromaxSession().then(function (data) {
      var allow =
        data &&
        data.ok &&
        (typeof window.cromaxSessionHasCapability === "function"
          ? window.cromaxSessionHasCapability(data, "dealers")
          : true);
      E.tb.hidden = !allow;
      S.csrfToken =
        data && data.ok && typeof data.csrfToken === "string" ? data.csrfToken : "";
    }).catch(function () {
      E.tb.hidden = true;
      S.csrfToken = "";
    });
  }

  function sanitizeDealersMapSvgText(svgText) {
    if (!svgText || typeof svgText !== "string") return null;
    var parser = new DOMParser();
    var doc = parser.parseFromString(svgText, "image/svg+xml");
    if (
      doc.querySelector("parsererror") ||
      !(doc.documentElement instanceof SVGElement) ||
      String(doc.documentElement.tagName).toLowerCase() !== "svg"
    ) {
      return null;
    }
    var allowedTags = {
      svg: true,
      g: true,
      path: true,
      title: true,
      desc: true,
      defs: true,
      clipPath: true,
      rect: true,
      circle: true,
      ellipse: true,
      polygon: true,
      polyline: true,
      line: true,
      symbol: true,
      use: true,
      text: true,
      tspan: true,
    };
    var allowedAttrs = {
      id: true,
      class: true,
      d: true,
      fill: true,
      stroke: true,
      "stroke-width": true,
      "stroke-linejoin": true,
      "stroke-linecap": true,
      "stroke-miterlimit": true,
      opacity: true,
      "fill-opacity": true,
      "stroke-opacity": true,
      transform: true,
      viewBox: true,
      width: true,
      height: true,
      x: true,
      y: true,
      cx: true,
      cy: true,
      r: true,
      rx: true,
      ry: true,
      x1: true,
      y1: true,
      x2: true,
      y2: true,
      points: true,
      role: true,
      tabindex: true,
      "aria-label": true,
      "aria-hidden": true,
      "data-region-id": true,
      "data-region-label": true,
      preserveAspectRatio: true,
      xmlns: true,
      "xmlns:xlink": true,
      "xlink:href": true,
      href: true,
      focusable: true,
      "clip-path": true,
      "vector-effect": true,
    };
    var all = doc.querySelectorAll("*");
    var i = 0;
    for (; i < all.length; i++) {
      var el = all[i];
      var tag = String(el.tagName || "").toLowerCase();
      if (!allowedTags[tag]) {
        el.remove();
        continue;
      }
      var attrs = [].slice.call(el.attributes || []);
      var j = 0;
      for (; j < attrs.length; j++) {
        var a = attrs[j];
        var n = a && a.name ? String(a.name) : "";
        var v = a && a.value ? String(a.value) : "";
        var lower = n.toLowerCase();
        if (lower.indexOf("on") === 0) {
          el.removeAttribute(n);
          continue;
        }
        if (lower === "href" || lower === "xlink:href") {
          if (v && v.charAt(0) === "#") continue;
          el.removeAttribute(n);
          continue;
        }
        if (lower.indexOf("data-") === 0) continue;
        if (!allowedAttrs[n] && !allowedAttrs[lower]) {
          el.removeAttribute(n);
        }
      }
    }
    return doc.documentElement;
  }

  if (E.bo) E.bo.addEventListener("click", openEditor);
  if (E.bc) E.bc.addEventListener("click", closeEditor);
  if (E.bsav) {
    E.bsav.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      editorSave();
    });
  }
  if (E.bad) E.bad.addEventListener("click", addEditorRow);
  window.addEventListener("cromaxEditorSessionChanged", syncToolbar);

  var dealersUrl = apiHref("read-dealers.php");
  var titlesHref = pageHref("dealers-region-titles-ru.json");
  var svgHref = pageHref("russia-dealers-map.generated.svg");

  Promise.all([
    dealersUrl
      ? fetch(dealersUrl, { credentials: "same-origin", cache: "no-cache" })
          .then(function (r) {
            return r.ok ? r.json() : { version: 1, byRegionId: {} };
          })
          .catch(function () {
            return { version: 1, byRegionId: {} };
          })
      : Promise.resolve({ version: 1, byRegionId: {} }),
    fetch(titlesHref, { cache: "no-cache" })
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .catch(function () {
        return {};
      }),
    fetch(svgHref, { cache: "no-cache" })
      .then(function (r) {
        return r.ok ? r.text() : "";
      })
      .catch(function () {
        return "";
      }),
  ])
    .then(function (triple) {
      S.data =
        triple[0] && typeof triple[0] === "object"
          ? triple[0]
          : { version: 1, byRegionId: {} };
      if (!S.data.byRegionId || typeof S.data.byRegionId !== "object") {
        S.data.byRegionId = {};
      }
      S.titles =
        triple[1] && typeof triple[1] === "object" ? triple[1] : {};
      fillBrowseSelect();
      if (E.sg) {
        E.sg.replaceChildren();
        var safeSvg = sanitizeDealersMapSvgText(
          triple[2] ? String(triple[2]) : ""
        );
        if (safeSvg) {
          E.sg.appendChild(document.importNode(safeSvg, true));
        } else {
          var msg = document.createElement("p");
          msg.className = "where-to-buy-svg-loading-msg";
          msg.textContent =
            "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043a\u0430\u0440\u0442\u0443.";
          E.sg.appendChild(msg);
        }
        wireSvgMount();
      }
      syncToolbar();
      setBrowse("", false);
      hl("is-selected", "");
    })
    .catch(function () {
      syncToolbar();
    });
})();
