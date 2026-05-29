/**
 * Подгрузка правок каталога (JSON) и вход «Мой New Site» (модалка).
 * Должен подключаться после catalog-products-data.js (если он есть), до product-detail.js и catalog.js.
 */
(function () {
  function pathnameDirSegmentCount(pathname) {
    let p = pathname || "/";
    const fileTail = /\/([^/]+)$/i.exec(p);
    if (fileTail && fileTail[1] && /\.[a-z0-9]+$/i.test(fileTail[1])) {
      p = p.slice(0, p.lastIndexOf("/"));
    }
    p = p.replace(/\/+$/, "");
    return p.replace(/^\/+/, "").split("/").filter(Boolean).length;
  }

  /**
   * URL каталога страницы (папки), без имени файла.
   * Нужен как базовый для resolving `../catalog/api/`, иначе при пути вида `/site/demo/who-we-are/page.html`
   * ошибочно получается `https://origin/catalog/api/` вместо `…/site/catalog/api/`.
   */
  function directoryBaseHref() {
    try {
      const u = new URL(window.location.href);
      const path = u.pathname || "/";
      const lastSeg = path.split("/").pop() || "";
      if (/\.[a-z0-9]{1,12}$/i.test(lastSeg)) {
        const dir = path.replace(/\/[^/]+$/, "") || "/";
        u.pathname = dir.endsWith("/") ? dir : `${dir}/`;
      } else if (!path.endsWith("/")) {
        u.pathname = `${path}/`;
      }
      return u.href;
    } catch {
      return window.location.href;
    }
  }

  /** Базовый URL catalog/api для текущего пути страницы (вложенность учитывается). */
  function getCromaxApiBase() {
    const pathname = window.location.pathname || "/";
    const depth = pathnameDirSegmentCount(pathname);
    const ups = depth > 0 ? "../".repeat(depth) : "";
    try {
      return new URL(`${ups}catalog/api/`, directoryBaseHref()).href;
    } catch {
      try {
        return new URL(`${ups || "../"}catalog/api/`, window.location.href).href;
      } catch {
        return new URL("../catalog/api/", window.location.href).href;
      }
    }
  }

  const API_BASE = getCromaxApiBase();

  function apiUrl(name) {
    return new URL(name, API_BASE).href;
  }

  function normalizeCharacteristicGroups(raw) {
    if (!Array.isArray(raw)) {
      return [];
    }
    const groups = [];
    for (let i = 0; i < raw.length; i += 1) {
      const g = raw[i];
      if (!g || typeof g !== "object") {
        continue;
      }
      const title = g.title != null ? String(g.title).trim() : "";
      const rowsIn = Array.isArray(g.rows) ? g.rows : [];
      const rows = [];
      for (let j = 0; j < rowsIn.length; j += 1) {
        const r = rowsIn[j];
        if (!r || typeof r !== "object") {
          continue;
        }
        const label = r.label != null ? String(r.label).trim() : "";
        const value = r.value != null ? String(r.value).trim() : "";
        if (label === "" && value === "") {
          continue;
        }
        rows.push({ label, value });
      }
      if (title === "" && rows.length === 0) {
        continue;
      }
      groups.push({ title, rows });
    }
    return groups;
  }

  function normalizeVariants(raw) {
    if (!Array.isArray(raw)) {
      return [];
    }
    const out = [];
    for (let i = 0; i < raw.length; i += 1) {
      const item = raw[i];
      if (!item || typeof item !== "object") {
        continue;
      }
      const variant = item.variant != null ? String(item.variant).trim() : "";
      const articleRef = item.articleRef != null ? String(item.articleRef).trim() : "";
      const materialCode = item.materialCode != null ? String(item.materialCode).trim() : "";
      if (variant === "" && articleRef === "" && materialCode === "") {
        continue;
      }
      out.push({ variant, articleRef, materialCode });
    }
    return out;
  }

  function mergeDescriptionRu(baseRu, patchRu) {
    if (!patchRu || typeof patchRu !== "object") {
      return baseRu;
    }
    const out =
      baseRu && typeof baseRu === "object" ? { ...baseRu } : { intro: "", bullets: [], variants: [] };
    if (Object.prototype.hasOwnProperty.call(patchRu, "intro")) {
      out.intro = patchRu.intro != null ? String(patchRu.intro) : "";
    }
    if (Array.isArray(patchRu.bullets)) {
      out.bullets = patchRu.bullets.map((b) => String(b).trim()).filter(Boolean);
    }
    if (Array.isArray(patchRu.variants)) {
      out.variants = normalizeVariants(patchRu.variants);
    }
    if (Object.prototype.hasOwnProperty.call(patchRu, "characteristicGroups")) {
      out.characteristicGroups = normalizeCharacteristicGroups(patchRu.characteristicGroups);
    }
    return out;
  }

  function applyProductPatch(prod, patch) {
    if (!prod || typeof prod !== "object" || !patch || typeof patch !== "object") {
      return;
    }
    const keys = [
      "name",
      "image",
      "technicalDataSheetUrl",
      "safetyDataSheetUrl",
      "productPageUrl",
    ];
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      if (!Object.prototype.hasOwnProperty.call(patch, k)) {
        continue;
      }
      const v = patch[k];
      if (v == null || v === "") {
        delete prod[k];
      } else {
        prod[k] = String(v).trim();
      }
    }
    if (Object.prototype.hasOwnProperty.call(patch, "descriptionRu")) {
      prod.descriptionRu = mergeDescriptionRu(prod.descriptionRu, patch.descriptionRu);
    }
  }

  function applyOverridesMap(overrides) {
    const products = window.CATALOG_PRODUCTS;
    if (!Array.isArray(products) || !overrides || typeof overrides !== "object") {
      return;
    }
    const keys = Object.keys(overrides);
    for (let i = 0; i < keys.length; i += 1) {
      const sku = keys[i];
      const patch = overrides[sku];
      if (!patch || typeof patch !== "object") {
        continue;
      }
      const prod = products.find((p) => String(p.sku) === String(sku));
      if (prod) {
        applyProductPatch(prod, patch);
      }
    }
  }

  function finishOverrides() {
    window.__CROMAX_OVERRIDES_APPLIED = true;
    window.dispatchEvent(new CustomEvent("cromaxOverridesMerged"));
  }

  fetch(apiUrl("read-overrides.php"), { credentials: "same-origin", cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : {}))
    .then((data) => {
      if (data && typeof data === "object") {
        applyOverridesMap(data);
      }
      finishOverrides();
    })
    .catch(() => {
      finishOverrides();
    });

  window.getCromaxApiBase = function () {
    return API_BASE;
  };

  window.fetchCromaxSession = function () {
    return fetch(apiUrl("session.php"), { credentials: "same-origin", cache: "no-cache" }).then((r) =>
      r.ok ? r.json() : { ok: false }
    );
  };

  /** Проверка зоны редактирования после входа («Мой New Site»): catalog | dealers | page_text */
  window.cromaxSessionHasCapability = function (sessionData, capability) {
    if (!sessionData || !sessionData.ok) return false;
    const caps = sessionData.capabilities;
    if (!Array.isArray(caps)) return true;
    return caps.indexOf(capability) !== -1;
  };

  function showAuthError(el, msg) {
    if (!el) {
      return;
    }
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  function openAuthModal(backdrop, session) {
    if (!backdrop) {
      return;
    }
    const loginPanel = backdrop.querySelector("#cromaxAuthPanelLogin");
    const sessionPanel = backdrop.querySelector("#cromaxAuthPanelSession");
    const userDisp = backdrop.querySelector("#cromaxAuthUserDisplay");
    const loggedIn = Boolean(session && session.ok && session.user);
    if (loginPanel) {
      loginPanel.hidden = loggedIn;
    }
    if (sessionPanel) {
      sessionPanel.hidden = !loggedIn;
    }
    if (userDisp && session && session.user) {
      userDisp.textContent = String(session.user);
    }
    backdrop.hidden = false;
    document.body.classList.add("cromax-modal-open");
    if (loggedIn) {
      const lo = backdrop.querySelector("#cromaxAuthLogout");
      if (lo instanceof HTMLElement) {
        lo.focus();
      }
    } else {
      const input = backdrop.querySelector("#cromaxLoginUser");
      if (input instanceof HTMLInputElement) {
        input.focus();
      }
    }
  }

  function closeModal(backdrop) {
    if (!backdrop) {
      return;
    }
    backdrop.hidden = true;
    document.body.classList.remove("cromax-modal-open");
  }

  function ensureAuthModal() {
    let backdrop = document.getElementById("cromaxAuthBackdrop");
    if (backdrop) {
      return backdrop;
    }
    backdrop = document.createElement("div");
    backdrop.id = "cromaxAuthBackdrop";
    backdrop.className = "cromax-modal-backdrop";
    backdrop.hidden = true;
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-labelledby", "cromaxAuthTitle");
    backdrop.innerHTML = [
      '<div class="cromax-modal">',
      '  <div class="cromax-modal-header">',
      '    <h2 id="cromaxAuthTitle" class="cromax-modal-title">Мой New Site</h2>',
      '    <button type="button" class="cromax-modal-close" id="cromaxAuthClose" aria-label="Закрыть">&times;</button>',
      "  </div>",
      '  <div id="cromaxAuthPanelLogin">',
      '    <form id="cromaxAuthForm" class="cromax-form" autocomplete="on">',
      '      <div class="cromax-field">',
      '        <label for="cromaxLoginUser">Логин</label>',
      '        <input type="text" id="cromaxLoginUser" name="user" required autocomplete="username">',
      "      </div>",
      '      <div class="cromax-field">',
      '        <label for="cromaxLoginPass">Пароль</label>',
      '        <input type="password" id="cromaxLoginPass" name="password" required autocomplete="current-password">',
      "      </div>",
      '      <p class="cromax-form-error" id="cromaxAuthError" hidden></p>',
      '      <div class="cromax-form-actions">',
      '        <button type="submit" class="btn btn-primary" id="cromaxAuthSubmit">Войти</button>',
      '        <button type="button" class="btn btn-ghost" id="cromaxAuthCancel">Отмена</button>',
      "      </div>",
      "    </form>",
      "  </div>",
      '  <div id="cromaxAuthPanelSession" class="cromax-form cromax-auth-session-panel" hidden>',
      '    <p class="cromax-auth-session-lead">Вы вошли как <strong id="cromaxAuthUserDisplay"></strong></p>',
      '    <div class="cromax-form-actions">',
      '      <button type="button" class="btn btn-primary" id="cromaxAuthLogout">Выйти</button>',
      '      <button type="button" class="btn btn-ghost" id="cromaxAuthSessionClose">Закрыть</button>',
      "    </div>",
      "  </div>",
      "</div>",
    ].join("");
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function initMetaLinkAuth() {
    const links = document.querySelectorAll("a.meta-link-user");
    if (!links.length) {
      return;
    }

    let backdrop = null;
    let wired = false;

    function wireAuthBackdrop(bd) {
      if (wired) {
        return;
      }
      wired = true;
      const form = bd.querySelector("#cromaxAuthForm");
      const errEl = bd.querySelector("#cromaxAuthError");
      const btnClose = bd.querySelector("#cromaxAuthClose");
      const btnCancel = bd.querySelector("#cromaxAuthCancel");
      const btnLogout = bd.querySelector("#cromaxAuthLogout");
      const btnSessionClose = bd.querySelector("#cromaxAuthSessionClose");

      btnClose?.addEventListener("click", () => closeModal(bd));
      btnCancel?.addEventListener("click", () => closeModal(bd));
      btnSessionClose?.addEventListener("click", () => closeModal(bd));
      btnLogout?.addEventListener("click", () => {
        fetch(apiUrl("logout.php"), { method: "POST", credentials: "same-origin" })
          .catch(() => {})
          .finally(() => {
            closeModal(bd);
            window.dispatchEvent(new CustomEvent("cromaxEditorSessionChanged", { detail: { user: null } }));
          });
      });
      bd.addEventListener("click", (e) => {
        if (e.target === bd) {
          closeModal(bd);
        }
      });

      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        const userEl = bd.querySelector("#cromaxLoginUser");
        const passEl = bd.querySelector("#cromaxLoginPass");
        const user = userEl instanceof HTMLInputElement ? userEl.value.trim() : "";
        const password = passEl instanceof HTMLInputElement ? passEl.value : "";
        showAuthError(errEl, "");
        fetch(apiUrl("login.php"), {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user, password }),
        })
          .then(async (r) => {
            const text = await r.text();
            let data = null;
            try {
              data = text.trim() ? JSON.parse(text) : null;
            } catch {
              data = null;
            }
            const parseFailed = Boolean(text.trim() && data === null);
            const emptyBody = !text.trim();
            // Успех только по телу JSON: часть хостингов/прокси даёт нестандартный HTTP-код при том же JSON.
            const loginOk =
              !parseFailed &&
              !emptyBody &&
              data &&
              data.ok === true &&
              typeof data.user === "string" &&
              data.user.trim() !== "";
            return {
              ok: loginOk,
              data,
              status: r.status,
              parseFailed,
              emptyBody,
            };
          })
          .then(({ ok, data, status, parseFailed, emptyBody }) => {
            if (ok) {
              closeModal(bd);
              window.dispatchEvent(new CustomEvent("cromaxEditorSessionChanged", { detail: { user: data.user } }));
              return;
            }
            let msg = "Не удалось войти.";
            if (emptyBody) {
              msg =
                "Пустой ответ сервера при входе (HTTP " +
                String(status) +
                "). Проверьте PHP catalog/api/login.php и логи хостинга.";
            } else if (parseFailed) {
              msg =
                "Ответ сервера при входе не JSON (часто из‑за ошибки PHP или прав на catalog/api/data). HTTP " +
                String(status) +
                ". Обратитесь к администратору хостинга.";
            } else if (data && data.error === "not_configured") {
              msg = "Вход не настроен на сервере (нет config.local.php).";
            } else if (data && data.error === "invalid_credentials") {
              msg = "Неверный логин или пароль.";
            } else if (data && data.error === "missing_credentials") {
              msg = "Не переданы логин или пароль (ошибка запроса). Обновите страницу и повторите.";
            } else if (data && data.error === "invalid_json") {
              msg =
                "Сервер не принял формат данных входа. Обновите страницу; если повторится — смотрите ограничения хостинга на POST JSON.";
            } else if (data && data.error === "method") {
              msg = "Сервер отклонил метод запроса (ожидался POST). Обратитесь к администратору.";
            } else if (status === 503) {
              msg = "Сервер не готов принять вход (HTTP 503).";
            } else if (data && data.error === "bootstrap_failed") {
              msg =
                "Ошибка загрузки API на сервере (PHP или файл bootstrap.php). Частая причина — версия PHP ниже 7.3; попросите хостинг включить 7.4+ или 8.x.";
            } else if (data && data.error === "server_exception") {
              msg =
                "Внутренняя ошибка при входе (HTTP 500). Смотрите логи PHP на хостинге или обратитесь в поддержку.";
            } else if (data && data.error === "encode_failed") {
              msg =
                "Ошибка формирования ответа на сервере (кодировка или данные сессии). Смотрите логи PHP.";
            } else if (data && typeof data.error === "string" && data.error) {
              msg = "Не удалось войти (" + data.error + ", HTTP " + String(status) + ").";
            } else if (!parseFailed && data && data.ok !== true) {
              msg = "Не удалось войти (HTTP " + String(status) + "). Ответ сервера без признака успеха.";
            }
            showAuthError(errEl, msg);
          })
          .catch(() => {
            showAuthError(errEl, "Ошибка сети. Проверьте подключение.");
          });
      });

      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && bd && !bd.hidden) {
          closeModal(bd);
        }
      });
    }

    links.forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (!backdrop) {
          backdrop = ensureAuthModal();
          wireAuthBackdrop(backdrop);
        }
        const errEl = backdrop.querySelector("#cromaxAuthError");
        showAuthError(errEl, "");
        window
          .fetchCromaxSession()
          .then((data) => {
            openAuthModal(backdrop, data && data.ok ? data : null);
          })
          .catch(() => {
            openAuthModal(backdrop, null);
          });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMetaLinkAuth);
  } else {
    initMetaLinkAuth();
  }
})();

/**
 * Редактируемые текстовые блоки страниц (plain text): data-cromax-text-key + overrides на сервере.
 */
(function () {
  const SEL = "[data-cromax-text-key]";
  const KEY_RE = /^[a-zA-Z0-9_.:-]{1,120}$/;

  /** Каталог и карта дилеров — свой редактор; общие тексты страниц не трогаем. */
  function isPageTextEditorExcluded() {
    try {
      const p = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
      if (p.includes("/catalog/")) return true;
      if (p.endsWith("/catalog") || p.endsWith("/catalog/")) return true;
      return p.endsWith("where-to-buy.html");
    } catch {
      return false;
    }
  }

  function apiHref(name) {
    if (typeof window.getCromaxApiBase !== "function") {
      return "";
    }
    try {
      return new URL(name, window.getCromaxApiBase()).href;
    } catch {
      return "";
    }
  }

  function collectBlocks(root) {
    const nodes = root.querySelectorAll(SEL);
    const list = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes[i];
      const key = el.getAttribute("data-cromax-text-key");
      if (!key || !KEY_RE.test(key.trim())) {
        continue;
      }
      const k = key.trim();
      list.push({ el, key: k, baseline: el.textContent });
    }
    return list;
  }

  function applyBlocks(blocksMap, items) {
    for (let i = 0; i < items.length; i += 1) {
      const { el, key, baseline } = items[i];
      const fromServer = blocksMap && typeof blocksMap[key] === "string" ? blocksMap[key] : null;
      el.textContent = fromServer != null && fromServer.trim() !== "" ? fromServer : baseline;
    }
  }

  let csrfToken = "";
  let editMode = false;
  let wired = false;

  function syncSession() {
    if (typeof window.fetchCromaxSession !== "function") {
      csrfToken = "";
      return Promise.resolve(false);
    }
    return window.fetchCromaxSession().then((data) => {
      csrfToken = data && data.ok && typeof data.csrfToken === "string" ? data.csrfToken : "";
      const allow =
        data &&
        data.ok &&
        (typeof window.cromaxSessionHasCapability === "function"
          ? window.cromaxSessionHasCapability(data, "page_text")
          : true);
      return Boolean(allow);
    }).catch(() => {
      csrfToken = "";
      return false;
    });
  }

  function saveErrorMessage(code) {
    if (code === "unauthorized") return "Сессия истекла. Войдите снова через «Мой New Site».";
    if (code === "forbidden_capability")
      return "У этой учётной записи нет прав на правку этого раздела. Обратитесь к администратору.";
    if (code === "csrf_failed") return "Сессия защиты истекла. Обновите страницу и войдите снова.";
    if (code === "origin_mismatch") return "Запрос отклонён по признаку origin/referer.";
    if (code === "rate_limited") return "Слишком много попыток. Подождите минуту и повторите.";
    if (code === "write_failed") return "Не удалось записать данные на сервер (папка catalog/api/data).";
    if (code === "invalid_json") return "Неверный формат запроса.";
    if (code === "empty_patch") return "Нечего сохранять.";
    if (code === "text_too_long") return "Текст слишком длинный (лимит на блок).";
    if (code === "invalid_patch_value") return "Неверное значение в правке.";
    if (typeof code === "string" && code) return code;
    return "";
  }

  function ensureUi(items) {
    let bar = document.getElementById("cromaxPageTextBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "cromaxPageTextBar";
      bar.className = "cromax-page-text-bar";
      bar.hidden = true;
      bar.innerHTML =
        '<span class="cromax-page-text-bar-label">Тексты страницы</span>' +
        '<span class="cromax-page-text-bar-hint" id="cromaxPageTextBarHint" hidden></span>' +
        '<button type="button" class="btn btn-ghost" id="cromaxPageTextToggle">Режим правки</button>';
      document.body.appendChild(bar);
    }

    const hintEl = bar.querySelector("#cromaxPageTextBarHint");
    const toggleBtn = bar.querySelector("#cromaxPageTextToggle");
    if (hintEl && toggleBtn) {
      if (items.length === 0) {
        hintEl.hidden = false;
        hintEl.textContent =
          "Нет размеченных блоков. Добавьте в HTML атрибут data-cromax-text-key (как на странице «О Cromax»).";
        toggleBtn.hidden = true;
      } else {
        hintEl.hidden = true;
        hintEl.textContent = "";
        toggleBtn.hidden = false;
      }
    }

    let backdrop = document.getElementById("cromaxPageTextModal");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "cromaxPageTextModal";
      backdrop.className = "cromax-modal-backdrop";
      backdrop.hidden = true;
      backdrop.setAttribute("role", "dialog");
      backdrop.setAttribute("aria-modal", "true");
      backdrop.innerHTML = [
        '<div class="cromax-modal cromax-page-text-modal">',
        '  <div class="cromax-modal-header">',
        '    <h2 class="cromax-modal-title" id="cromaxPageTextModalTitle">Текст блока</h2>',
        '    <button type="button" class="cromax-modal-close" id="cromaxPageTextModalClose" aria-label="Закрыть">&times;</button>',
        "  </div>",
        '  <p class="cromax-page-text-keyline"><code id="cromaxPageTextKeyDisplay"></code></p>',
        '  <textarea id="cromaxPageTextArea" class="cromax-page-text-area" rows="8"></textarea>',
        '  <p class="cromax-form-error" id="cromaxPageTextModalErr" hidden></p>',
        '  <div class="cromax-form-actions">',
        '    <button type="button" class="btn btn-primary" id="cromaxPageTextSave">Сохранить</button>',
        '    <button type="button" class="btn btn-ghost" id="cromaxPageTextRevert">Сбросить к версии из HTML</button>',
        '    <button type="button" class="btn btn-ghost" id="cromaxPageTextCancel">Отмена</button>',
        "  </div>",
        "</div>",
      ].join("");
      document.body.appendChild(backdrop);
    }

    if (wired) {
      return { bar, backdrop };
    }
    wired = true;

    const toggle = bar.querySelector("#cromaxPageTextToggle");
    toggle?.addEventListener("click", () => {
      if (!items.length) return;
      editMode = !editMode;
      document.body.classList.toggle("cromax-page-text-edit-mode", editMode);
      if (toggle) {
        toggle.textContent = editMode ? "Закончить правку" : "Режим правки";
      }
    });

    let modalKey = "";

    function closeModal() {
      backdrop.hidden = true;
      modalKey = "";
      document.body.classList.remove("cromax-modal-open");
    }

    function showModalErr(msg) {
      const errEl = backdrop.querySelector("#cromaxPageTextModalErr");
      if (!errEl) return;
      errEl.textContent = msg || "";
      errEl.hidden = !msg;
    }

    backdrop.querySelector("#cromaxPageTextModalClose")?.addEventListener("click", closeModal);
    backdrop.querySelector("#cromaxPageTextCancel")?.addEventListener("click", closeModal);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !backdrop.hidden) {
        closeModal();
      }
    });

    backdrop.querySelector("#cromaxPageTextRevert")?.addEventListener("click", () => {
      const ta = backdrop.querySelector("#cromaxPageTextArea");
      if (!(ta instanceof HTMLTextAreaElement) || !modalKey) return;
      const hit = items.find((x) => x.key === modalKey);
      ta.value = hit ? hit.baseline : "";
      showModalErr("");
    });

    backdrop.querySelector("#cromaxPageTextSave")?.addEventListener("click", () => {
      const ta = backdrop.querySelector("#cromaxPageTextArea");
      if (!(ta instanceof HTMLTextAreaElement) || !modalKey) return;
      const href = apiHref("save-page-text-overrides.php");
      if (!href) {
        showModalErr("Не удалось определить URL API.");
        return;
      }
      if (!csrfToken) {
        showModalErr("Нет CSRF-токена сессии. Обновите страницу и войдите снова.");
        return;
      }
      showModalErr("");
      const payload = { patch: { [modalKey]: ta.value } };
      fetch(href, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "X-Cromax-CSRF": csrfToken,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(payload),
      })
        .then((r) =>
          r.text().then((text) => {
            let j = null;
            if (text) {
              try {
                j = JSON.parse(text);
              } catch {
                /* ignore */
              }
            }
            return { okHttp: r.ok, status: r.status, j, raw: text };
          })
        )
        .then((x) => {
          if (x.okHttp && x.j && x.j.ok && x.j.doc && typeof x.j.doc === "object") {
            const blocks = x.j.doc.blocks && typeof x.j.doc.blocks === "object" ? x.j.doc.blocks : {};
            applyBlocks(blocks, items);
            closeModal();
            return;
          }
          const code = x.j && typeof x.j.error === "string" ? x.j.error : "";
          let msg = saveErrorMessage(code);
          if (!msg && x.raw && x.raw.length < 400) msg = x.raw;
          showModalErr(msg || `Сохранение не удалось (HTTP ${x.status || "?"}).`);
        })
        .catch(() => {
          showModalErr("Ошибка сети или ответ сервера не JSON.");
        });
    });

    for (let i = 0; i < items.length; i += 1) {
      const { el, key } = items[i];
      el.addEventListener("click", (ev) => {
        if (!editMode) return;
        ev.preventDefault();
        ev.stopPropagation();
        modalKey = key;
        const ta = backdrop.querySelector("#cromaxPageTextArea");
        const kd = backdrop.querySelector("#cromaxPageTextKeyDisplay");
        if (kd) kd.textContent = key;
        if (ta instanceof HTMLTextAreaElement) {
          ta.value = el.textContent;
        }
        showModalErr("");
        backdrop.hidden = false;
        document.body.classList.add("cromax-modal-open");
        ta?.focus();
      });
    }

    return { bar, backdrop };
  }

  function refreshBar(items) {
    syncSession().then((ok) => {
      const bar = document.getElementById("cromaxPageTextBar");
      if (!bar) return;
      bar.hidden = !ok;
    });
  }

  function run() {
    if (isPageTextEditorExcluded()) {
      return;
    }

    const items = collectBlocks(document);

    const finish = (blocksMap) => {
      applyBlocks(blocksMap, items);
      ensureUi(items);
      refreshBar(items);
      window.addEventListener("cromaxEditorSessionChanged", () => {
        refreshBar(items);
      });
    };

    if (!items.length) {
      finish({});
      return;
    }

    const href = apiHref("read-page-text-overrides.php");
    if (!href) {
      finish({});
      return;
    }

    fetch(href, { credentials: "same-origin", cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((doc) => {
        const blocks = doc && doc.blocks && typeof doc.blocks === "object" ? doc.blocks : {};
        finish(blocks);
      })
      .catch(() => finish({}));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
