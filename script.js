/**
 * Базовые настройки слайдеров — те же значения, что в библиотечном компоненте и в БД.
 * При рендере из CMS значения подставляются в data-slider-autoplay-ms и data-slider-mobile-max на корне слайдера.
 */
const SLIDER_CONFIG = Object.freeze({
  autoplayIntervalMs: 7000,
  mobileMaxWidthPx: 920,
});

function readSliderPositiveInt(raw, fallback) {
  const n = parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const heroSliderRoot = document.getElementById("heroSlider");
const heroAutoplayMs = readSliderPositiveInt(heroSliderRoot?.dataset?.sliderAutoplayMs, SLIDER_CONFIG.autoplayIntervalMs);
const siteMobileMaxPx = readSliderPositiveInt(heroSliderRoot?.dataset?.sliderMobileMax, SLIDER_CONFIG.mobileMaxWidthPx);

const slides = Array.from(document.querySelectorAll(".hero-slide"));
const dotsContainer = document.getElementById("sliderDots");
const prevBtn = document.getElementById("prevSlide");
const nextBtn = document.getElementById("nextSlide");
const heroMediaElements = slides
  .map((slide) => slide.querySelector(".hero-media"))
  .filter((media) => media instanceof HTMLElement);
const diagonalHeroMq = window.matchMedia("(min-width: 1000px) and (max-width: 1200px)");

let activeSlide = 0;
let autoTimer;
let heroDotButtons = [];

function syncHeroMediaHeight() {
  if (!slides.length) {
    return;
  }

  if (diagonalHeroMq.matches) {
    heroMediaElements.forEach((media) => {
      media.style.height = "";
    });
    return;
  }

  const firstMedia = heroMediaElements[0];
  if (!(firstMedia instanceof HTMLElement)) {
    return;
  }

  const firstHeight = Math.round(firstMedia.getBoundingClientRect().height);
  if (firstHeight <= 0) {
    return;
  }

  heroMediaElements.forEach((media) => {
    media.style.height = `${firstHeight}px`;
  });
}

function setHeroDotsActive() {
  if (!heroDotButtons.length) {
    return;
  }
  heroDotButtons.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === activeSlide);
  });
}

function initHeroDots() {
  if (!dotsContainer || !slides.length) {
    return;
  }
  dotsContainer.innerHTML = "";
  heroDotButtons = slides.map((_, idx) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Перейти к слайду ${idx + 1}`);
    dot.addEventListener("click", () => goToSlide(idx));
    dotsContainer.append(dot);
    return dot;
  });
  setHeroDotsActive();
}

function goToSlide(index) {
  if (!slides.length) {
    return;
  }
  activeSlide = (index + slides.length) % slides.length;
  slides.forEach((slide, idx) => {
    slide.classList.toggle("is-active", idx === activeSlide);
  });
  setHeroDotsActive();
}

function startAutoplay() {
  stopAutoplay();
  if (!slides.length) {
    return;
  }
  autoTimer = window.setInterval(() => {
    goToSlide(activeSlide + 1);
  }, heroAutoplayMs);
}

function stopAutoplay() {
  if (autoTimer) {
    window.clearInterval(autoTimer);
    autoTimer = undefined;
  }
}

prevBtn?.addEventListener("click", () => {
  goToSlide(activeSlide - 1);
  startAutoplay();
});

nextBtn?.addEventListener("click", () => {
  goToSlide(activeSlide + 1);
  startAutoplay();
});

heroSliderRoot?.addEventListener("mouseenter", stopAutoplay);
heroSliderRoot?.addEventListener("mouseleave", startAutoplay);

initHeroDots();
startAutoplay();
syncHeroMediaHeight();

const firstSlideImage = slides[0]?.querySelector(".hero-media img");
if (firstSlideImage instanceof HTMLImageElement) {
  if (firstSlideImage.complete) {
    syncHeroMediaHeight();
  } else {
    firstSlideImage.addEventListener("load", syncHeroMediaHeight, { once: true });
  }
}

window.addEventListener("load", syncHeroMediaHeight, { once: true });
window.addEventListener("resize", syncHeroMediaHeight, { passive: true });

const searchToggle = document.getElementById("searchToggle");
const searchBox = document.getElementById("searchBox");
const searchCluster = document.getElementById("searchCluster");
const topMeta = document.getElementById("topMeta");

(function injectSiteSearchChrome() {
  const cluster = document.getElementById("searchCluster");
  const toggle = document.getElementById("searchToggle");
  const box = document.getElementById("searchBox");
  if (!cluster || !toggle || !box) {
    return;
  }
  if (toggle instanceof HTMLButtonElement) {
    toggle.type = "button";
  }
  const inp =
    box.querySelector('input[name="q"]') ??
    box.querySelector('input[type="search"]') ??
    box.querySelector("input");
  if (inp instanceof HTMLInputElement && inp.type === "search") {
    inp.type = "text";
    inp.setAttribute("enterkeyhint", "search");
    inp.setAttribute("inputmode", "search");
    inp.setAttribute("autocomplete", "off");
  }
  if (document.getElementById("searchSubmitRound")) {
    return;
  }
  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.setAttribute("form", box.id);
  submitBtn.className = "search-submit-round";
  submitBtn.id = "searchSubmitRound";
  submitBtn.setAttribute("aria-label", "Найти");
  submitBtn.innerHTML =
    '<span class="meta-round"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>';
  toggle.insertAdjacentElement("beforebegin", submitBtn);
})();

const searchInput = searchBox?.querySelector('input[name="q"]') ?? searchBox?.querySelector("input");

/** База сайта по расположению `script.js` (корень с `index.html`). */
function getCromaxSiteRootBaseUrl() {
  const candidates = [...document.scripts].filter((el) => {
    if (!el.src) {
      return false;
    }
    const pathOnly = el.src.split("?")[0];
    return /(^|\/)script\.js$/i.test(pathOnly);
  });
  const el = candidates[candidates.length - 1];
  if (!el?.src) {
    return new URL("./", window.location.href).href;
  }
  try {
    const u = new URL(el.src);
    u.hash = "";
    u.search = "";
    const dir = u.pathname.replace(/\/[^/]+$/, "");
    u.pathname = dir.endsWith("/") ? dir : `${dir}/`;
    return u.href;
  } catch {
    return new URL("./", window.location.href).href;
  }
}

function goToSiteSearchPage(query) {
  const base = getCromaxSiteRootBaseUrl();
  try {
    const u = new URL("search.html", base);
    u.searchParams.set("q", query);
    window.location.href = u.href;
  } catch {
    window.location.href = `./search.html?q=${encodeURIComponent(query)}`;
  }
}

function syncSearchAriaExpanded(open) {
  if (!searchToggle) {
    return;
  }
  searchToggle.setAttribute("aria-expanded", open ? "true" : "false");
  searchToggle.setAttribute("aria-label", open ? "Закрыть поиск" : "Открыть поиск");
}

function setSiteSearchOpen(open) {
  searchBox?.classList.toggle("open", open);
  searchCluster?.classList.toggle("open", open);
  topMeta?.classList.toggle("search-open", open);
  syncSearchAriaExpanded(open);
  if (open) {
    searchInput?.focus();
  }
}

function closeSearch() {
  setSiteSearchOpen(false);
}

if (searchToggle && !searchBox?.classList.contains("open")) {
  syncSearchAriaExpanded(false);
}

searchBox?.addEventListener("submit", (event) => {
  const q = searchInput?.value?.trim() || "";
  if (!q) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  goToSiteSearchPage(q);
});

searchToggle?.addEventListener("click", (event) => {
  event.preventDefault();
  const isOpen = searchBox?.classList.contains("open");
  if (!isOpen) {
    setSiteSearchOpen(true);
    return;
  }
  const q = searchInput?.value?.trim() || "";
  if (q) {
    if (searchInput) {
      searchInput.value = "";
    }
    searchInput?.focus();
    return;
  }
  setSiteSearchOpen(false);
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (!searchCluster?.contains(target)) {
    closeSearch();
  }
});

const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const mainNav = document.getElementById("mainNav");
const mobileNavBackdrop = document.getElementById("mobileNavBackdrop");
const siteHeader = document.getElementById("siteHeader");
const axaltaRibbon = document.getElementById("axaltaRibbon");
const mainNavWrap = document.querySelector(".main-nav-wrap");
const navItems = Array.from(document.querySelectorAll(".main-nav .has-submenu"));
const thirdLevelEntries = Array.from(document.querySelectorAll(".submenu-entry.has-third-level"));

let navMobileScrollLockY = 0;
let navMobileScrollLockActive = false;

function isMobileNavViewport() {
  return window.matchMedia(`(max-width: ${siteMobileMaxPx}px)`).matches;
}

function applyMobileNavScrollLock(locked) {
  if (locked) {
    if (!isMobileNavViewport()) {
      return;
    }
    navMobileScrollLockY = window.scrollY;
    navMobileScrollLockActive = true;
    document.body.style.position = "fixed";
    document.body.style.top = `-${navMobileScrollLockY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    return;
  }
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  if (navMobileScrollLockActive) {
    window.scrollTo(0, navMobileScrollLockY);
    navMobileScrollLockActive = false;
  }
}

function setMainNavDrawerOpen(open) {
  mainNav?.classList.toggle("open", open);
  mobileMenuToggle?.classList.toggle("is-open", open);
  if (mobileMenuToggle) {
    mobileMenuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    mobileMenuToggle.setAttribute("aria-label", open ? "Закрыть навигацию" : "Открыть навигацию");
  }
  document.documentElement.classList.toggle("nav-mobile-open", Boolean(open));
  document.body.classList.toggle("nav-mobile-open", Boolean(open));
  applyMobileNavScrollLock(open);
  if (mobileNavBackdrop) {
    mobileNavBackdrop.hidden = !open;
    mobileNavBackdrop.setAttribute("aria-hidden", open ? "false" : "true");
  }
  if (open && isMobileNavViewport()) {
    requestAnimationFrame(() => {
      syncSubmenuTop();
    });
  } else {
    syncSubmenuTop();
  }
}

function closeMainNavDrawer() {
  setMainNavDrawerOpen(false);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSearch();
    closeAllSubmenus();
    closeMainNavDrawer();
  }
});

mobileMenuToggle?.addEventListener("click", () => {
  const willOpen = !mainNav?.classList.contains("open");
  if (!willOpen) {
    closeAllSubmenus();
  }
  setMainNavDrawerOpen(willOpen);
});

mobileNavBackdrop?.addEventListener("click", () => {
  closeAllSubmenus();
  closeMainNavDrawer();
});

mainNav?.addEventListener("click", (event) => {
  const el = event.target;
  if (!(el instanceof Element)) {
    return;
  }
  const anchor = el.closest("a[href]");
  if (!anchor || !mainNav.contains(anchor)) {
    return;
  }
  closeAllSubmenus();
  closeMainNavDrawer();
});

function closeAllSubmenus() {
  closeAllThirdMenus();
  navItems.forEach((item) => {
    item.classList.remove("is-open");
    const trigger = item.querySelector(".nav-trigger");
    if (trigger instanceof HTMLElement) {
      trigger.setAttribute("aria-expanded", "false");
    }
  });
  mainNavWrap?.classList.remove("has-open-submenu");
}

function closeAllThirdMenus() {
  thirdLevelEntries.forEach((entry) => {
    entry.classList.remove("is-open");
    const trigger = entry.querySelector(".submenu-entry-trigger");
    if (trigger instanceof HTMLElement) {
      trigger.setAttribute("aria-expanded", "false");
    }
  });
}

function syncSubmenuTop() {
  if (siteHeader) {
    const rect = siteHeader.getBoundingClientRect();
    document.documentElement.style.setProperty("--mobile-nav-top", `${Math.max(0, Math.round(rect.bottom))}px`);
  }

  if (!mainNavWrap) {
    return;
  }

  const headerBottom = siteHeader
    ? Math.round(siteHeader.getBoundingClientRect().bottom)
    : Math.round(mainNavWrap.getBoundingClientRect().bottom);

  const openItem = document.querySelector(".nav-item.is-open");
  const openTrigger =
    openItem?.querySelector(".nav-trigger") instanceof HTMLElement
      ? openItem.querySelector(".nav-trigger")
      : null;

  let submenuTop = headerBottom;
  let padTop = "0px";
  let submenuZ = "8";

  /* Десктоп: верхняя граница подменю стыкуется с красной полосой триггера (без белой щели), если логотип
     не уходит ниже этой линии — иначе оставляем привязку к низу шапки, чтобы не перекрывать бренд. */
  if (!isMobileNavViewport() && siteHeader && openTrigger) {
    const triggerBottom = Math.round(openTrigger.getBoundingClientRect().bottom);
    const brandWrap = document.querySelector(".brand-wrap");
    const brandBottom =
      brandWrap instanceof HTMLElement ? Math.round(brandWrap.getBoundingClientRect().bottom) : 0;
    const canFlushSubmenu = brandBottom <= triggerBottom + 1;
    if (canFlushSubmenu) {
      submenuTop = triggerBottom;
      padTop = `${Math.max(0, headerBottom - triggerBottom)}px`;
      submenuZ = "31";
    }
  }

  document.documentElement.style.setProperty("--submenu-top", `${submenuTop}px`);
  document.documentElement.style.setProperty("--submenu-pad-top", padTop);
  document.documentElement.style.setProperty("--submenu-z", submenuZ);

  const openSubmenu = document.querySelector(".nav-item.is-open .submenu-panel");
  if (openSubmenu instanceof HTMLElement) {
    const thirdTop = Math.round(openSubmenu.getBoundingClientRect().bottom);
    document.documentElement.style.setProperty("--thirdmenu-top", `${thirdTop}px`);
  }
}

navItems.forEach((item) => {
  const trigger = item.querySelector(".nav-trigger");
  if (!(trigger instanceof HTMLElement)) {
    return;
  }

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    const willOpen = !item.classList.contains("is-open");
    closeAllSubmenus();
    item.classList.toggle("is-open", willOpen);
    trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    mainNavWrap?.classList.toggle("has-open-submenu", willOpen);
    if (willOpen) {
      requestAnimationFrame(() => {
        syncSubmenuTop();
      });
    } else {
      syncSubmenuTop();
    }
  });
});

thirdLevelEntries.forEach((entry) => {
  const trigger = entry.querySelector(".submenu-entry-trigger");
  if (!(trigger instanceof HTMLElement)) {
    return;
  }

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    const willOpen = !entry.classList.contains("is-open");
    closeAllThirdMenus();
    entry.classList.toggle("is-open", willOpen);
    trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    syncSubmenuTop();
  });
});

const defaultOpenItem = navItems.find((item) => item.classList.contains("is-open"));
mainNavWrap?.classList.toggle("has-open-submenu", Boolean(defaultOpenItem));
syncSubmenuTop();
if (siteHeader && typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => syncSubmenuTop()).observe(siteHeader);
}
window.addEventListener("load", syncSubmenuTop, { passive: true });

function syncHeaderState() {
  if (!siteHeader) {
    return;
  }
  const ribbonHidden = window.scrollY > 0;
  siteHeader.classList.toggle("is-compact", window.scrollY > 16);
  siteHeader.classList.toggle("is-ribbon-hidden", ribbonHidden);
  axaltaRibbon?.setAttribute("aria-hidden", ribbonHidden ? "true" : "false");
  syncSubmenuTop();
}

window.addEventListener("scroll", syncHeaderState, { passive: true });
window.addEventListener(
  "resize",
  () => {
    if (window.matchMedia(`(min-width: ${siteMobileMaxPx + 1}px)`).matches) {
      closeAllSubmenus();
      closeMainNavDrawer();
    }
    syncSubmenuTop();
  },
  { passive: true },
);
syncHeaderState();

const disclaimer = document.getElementById("externalDisclaimer");
const continueExternal = document.getElementById("continueExternal");
const cancelExternal = document.getElementById("cancelExternal");
let pendingExternalLink = "";

function isExternalUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return parsed.host !== window.location.host;
  } catch {
    return false;
  }
}

/** Внешние ссылки без модального предупреждения (доверенные партнёрские домены). */
function isExternalLinkDisclaimerExempt(url) {
  try {
    const host = new URL(url, window.location.href).hostname;
    return host === "audurra.ru" || host.endsWith(".audurra.ru");
  } catch {
    return false;
  }
}

document.addEventListener(
  "click",
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const placeholder = target.closest('a[href="#"]');
    if (placeholder && placeholder.id !== "continueExternal") {
      event.preventDefault();
    }
  },
  true,
);

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (!target.closest(".main-nav-wrap")) {
    closeAllSubmenus();
    closeMainNavDrawer();
  } else if (!target.closest(".main-nav")) {
    closeAllSubmenus();
    syncSubmenuTop();
  }

  const anchor = target.closest("a[href]");
  if (!anchor) {
    return;
  }

  const href = anchor.getAttribute("href") || "";
  if (!isExternalUrl(href)) {
    return;
  }
  if (isExternalLinkDisclaimerExempt(href)) {
    return;
  }

  event.preventDefault();
  pendingExternalLink = anchor.href;
  disclaimer?.classList.add("show");
  disclaimer?.setAttribute("aria-hidden", "false");
});

continueExternal?.addEventListener("click", (event) => {
  event.preventDefault();
  if (pendingExternalLink && isExternalUrl(pendingExternalLink)) {
    window.open(pendingExternalLink, "_blank", "noopener,noreferrer");
  }
  pendingExternalLink = "";
  disclaimer?.classList.remove("show");
  disclaimer?.setAttribute("aria-hidden", "true");
});

cancelExternal?.addEventListener("click", () => {
  pendingExternalLink = "";
  disclaimer?.classList.remove("show");
  disclaimer?.setAttribute("aria-hidden", "true");
});

disclaimer?.addEventListener("click", (event) => {
  if (event.target === disclaimer) {
    pendingExternalLink = "";
    disclaimer.classList.remove("show");
    disclaimer.setAttribute("aria-hidden", "true");
  }
});

/** Локальное уведомление о cookie (152-ФЗ / прозрачность для пользователя); без внешних скриптов из‑за CSP. */
const COOKIE_CONSENT_STORAGE_KEY = "cromax_cookie_consent_v1";

function readCookieConsentState() {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") {
      return null;
    }
    if (o.level !== "all" && o.level !== "essential" && o.level !== "custom") {
      return null;
    }
    return o;
  } catch {
    return null;
  }
}

function writeCookieConsentState(state) {
  const payload = { v: 1, ts: Date.now(), ...state };
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage недоступно — баннер может появляться снова */
  }
  window.dispatchEvent(new CustomEvent("cromax-cookie-consent", { detail: payload }));
}

function privacyStatementPageHref() {
  try {
    const p = (window.location.pathname || "").replace(/\\/g, "/");
    if (p.includes("/products/") || p.includes("/catalog/")) {
      return "../privacy-statement.html";
    }
  } catch {
    /* ignore */
  }
  return "./privacy-statement.html";
}

function initCookieConsentBanner() {
  if (readCookieConsentState()) {
    return;
  }

  const privacyHref = `${privacyStatementPageHref()}#cromax-privacy-policy-anchor`;

  const root = document.createElement("div");
  root.id = "onetrust-consent-sdk";
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "Уведомление об использовании файлов cookie");
  root.lang = "ru";

  root.innerHTML = `
    <div id="onetrust-banner-sdk">
      <div class="ot-sdk-container">
        <button type="button" class="cookie-banner-close" id="cookieBannerClose" aria-label="Закрыть: только необходимые cookie">&times;</button>
        <div class="ot-sdk-row">
          <div id="onetrust-group-container" class="ot-sdk-twelve ot-sdk-columns">
            Мы используем файлы cookie и аналогичные технологии для работы сайта, персонализации контента и рекламы,
            интеграции с социальными сетями и анализа трафика. Используя сайт, вы подтверждаете, что ознакомлены
            с информацией об обработке данных в соответствии с Федеральным законом № 152-ФЗ «О персональных данных»,
            и соглашаетесь на применение cookie, если вы включили соответствующие категории ниже или нажали «Принять все».
            Подробности — в
            <a id="cookieBannerPrivacyLink" href="${privacyHref}">Заявлении о конфиденциальности</a>.
          </div>
          <div id="onetrust-button-group-parent" class="ot-sdk-twelve ot-sdk-columns has-reject-all-button">
            <button type="button" class="btn cookie-banner-btn-pref" id="cookieBannerPrefs">Центр настроек cookie</button>
            <button type="button" class="btn cookie-banner-btn-reject" id="cookieBannerReject">Отклонить необязательные</button>
            <button type="button" class="btn cookie-banner-btn-accept" id="cookieBannerAccept">Принять все cookie</button>
          </div>
          <div class="cookie-preferences-panel" id="cookiePreferencesPanel" hidden>
            <div class="cookie-pref-field">
              <label>
                <input type="checkbox" id="cookiePrefNecessary" checked disabled>
                <span>Строго необходимые</span>
              </label>
              <span class="cookie-pref-hint">Нужны для базовой работы сайта и безопасности; отключить нельзя.</span>
            </div>
            <div class="cookie-pref-field">
              <label>
                <input type="checkbox" id="cookiePrefAnalytics">
                <span>Аналитика и улучшение сервиса</span>
              </label>
              <span class="cookie-pref-hint">Помогают понять, как посетители пользуются сайтом (обезличенная статистика).</span>
            </div>
            <div class="cookie-pref-field">
              <label>
                <input type="checkbox" id="cookiePrefMarketing">
                <span>Контент, реклама и соцсети</span>
              </label>
              <span class="cookie-pref-hint">Персонализация, рекламные и социальные виджеты — только при вашем согласии.</span>
            </div>
            <div class="cookie-pref-actions">
              <button type="button" class="btn btn-primary" id="cookieBannerSavePrefs">Сохранить настройки</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.append(root);

  const panel = root.querySelector("#cookiePreferencesPanel");
  const prefBtn = root.querySelector("#cookieBannerPrefs");
  const analyticsCb = root.querySelector("#cookiePrefAnalytics");
  const marketingCb = root.querySelector("#cookiePrefMarketing");

  function removeBanner() {
    root.remove();
  }

  function consentFromCheckboxes() {
    const analytics = Boolean(analyticsCb?.checked);
    const marketing = Boolean(marketingCb?.checked);
    let level = "essential";
    if (analytics && marketing) {
      level = "all";
    } else if (analytics || marketing) {
      level = "custom";
    }
    writeCookieConsentState({ level, analytics, marketing });
    removeBanner();
  }

  function acceptAll() {
    if (analyticsCb) {
      analyticsCb.checked = true;
    }
    if (marketingCb) {
      marketingCb.checked = true;
    }
    writeCookieConsentState({ level: "all", analytics: true, marketing: true });
    removeBanner();
  }

  function rejectNonEssential() {
    if (analyticsCb) {
      analyticsCb.checked = false;
    }
    if (marketingCb) {
      marketingCb.checked = false;
    }
    writeCookieConsentState({ level: "essential", analytics: false, marketing: false });
    removeBanner();
  }

  root.querySelector("#cookieBannerAccept")?.addEventListener("click", acceptAll);
  root.querySelector("#cookieBannerReject")?.addEventListener("click", rejectNonEssential);
  root.querySelector("#cookieBannerClose")?.addEventListener("click", rejectNonEssential);
  root.querySelector("#cookieBannerSavePrefs")?.addEventListener("click", consentFromCheckboxes);

  prefBtn?.addEventListener("click", () => {
    if (!panel) {
      return;
    }
    if (panel.hasAttribute("hidden")) {
      panel.removeAttribute("hidden");
      prefBtn.setAttribute("aria-expanded", "true");
    } else {
      panel.setAttribute("hidden", "");
      prefBtn.setAttribute("aria-expanded", "false");
    }
  });

  prefBtn?.setAttribute("aria-expanded", "false");
  prefBtn?.setAttribute("aria-controls", "cookiePreferencesPanel");
}

initCookieConsentBanner();

const productSystemsTrack = document.getElementById("productSystemsSlider");
const productSystemsDots = document.getElementById("productSystemsDots");
const productSystemsOuter = document.querySelector(".product-systems-slider-outer");
const productSystemsPrev = document.getElementById("productSystemsPrev");
const productSystemsNext = document.getElementById("productSystemsNext");

function addMediaQueryChangeListener(mediaQueryList, listener) {
  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", listener);
    return;
  }
  if (typeof mediaQueryList.addListener === "function") {
    mediaQueryList.addListener(listener);
  }
}

(function initProductSystemsSlider() {
  if (!productSystemsTrack || !productSystemsDots) {
    return;
  }

  const slides = Array.from(productSystemsTrack.querySelectorAll(".product-tile"));
  if (!slides.length) {
    return;
  }

  const systemsMobileMax = readSliderPositiveInt(
    productSystemsTrack.dataset?.sliderMobileMax,
    SLIDER_CONFIG.mobileMaxWidthPx
  );
  const systemsAutoplayMs = readSliderPositiveInt(
    productSystemsTrack.dataset?.sliderAutoplayMs,
    SLIDER_CONFIG.autoplayIntervalMs
  );
  const mq = window.matchMedia(`(max-width: ${systemsMobileMax}px)`);
  let scrollSyncRaf = 0;
  let systemsAutoTimer;

  function scrollBehavior() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }

  function activeIndexFromScroll() {
    const viewMid = productSystemsTrack.scrollLeft + productSystemsTrack.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    slides.forEach((el, i) => {
      const mid = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(mid - viewMid);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  function updateDotsActive(index) {
    productSystemsDots.querySelectorAll("button").forEach((btn, i) => {
      btn.classList.toggle("active", i === index);
    });
  }

  function scrollTrackToSlide(i) {
    const slide = slides[i];
    const track = productSystemsTrack;
    const left =
      slide.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
    track.scrollTo({
      left,
      behavior: scrollBehavior(),
    });
  }

  function goToSystemsSlide(index) {
    if (!mq.matches) {
      return;
    }
    const i = (index + slides.length) % slides.length;
    scrollTrackToSlide(i);
    updateDotsActive(i);
  }

  function renderDots() {
    productSystemsDots.innerHTML = "";
    if (!mq.matches) {
      productSystemsDots.hidden = true;
      return;
    }

    productSystemsDots.hidden = false;
    const current = activeIndexFromScroll();
    slides.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = i === current ? "active" : "";
      dot.setAttribute("aria-label", `Перейти к слайду ${i + 1}`);
      dot.addEventListener("click", () => {
        goToSystemsSlide(i);
        startSystemsAutoplay();
      });
      productSystemsDots.append(dot);
    });
  }

  function onScroll() {
    if (scrollSyncRaf) {
      return;
    }
    scrollSyncRaf = window.requestAnimationFrame(() => {
      scrollSyncRaf = 0;
      if (!mq.matches) {
        return;
      }
      updateDotsActive(activeIndexFromScroll());
    });
  }

  function stopSystemsAutoplay() {
    if (systemsAutoTimer) {
      window.clearInterval(systemsAutoTimer);
      systemsAutoTimer = undefined;
    }
  }

  function startSystemsAutoplay() {
    stopSystemsAutoplay();
    if (!mq.matches) {
      return;
    }
    systemsAutoTimer = window.setInterval(() => {
      goToSystemsSlide(activeIndexFromScroll() + 1);
    }, systemsAutoplayMs);
  }

  productSystemsPrev?.addEventListener("click", () => {
    goToSystemsSlide(activeIndexFromScroll() - 1);
    startSystemsAutoplay();
  });

  productSystemsNext?.addEventListener("click", () => {
    goToSystemsSlide(activeIndexFromScroll() + 1);
    startSystemsAutoplay();
  });

  productSystemsOuter?.addEventListener("mouseenter", stopSystemsAutoplay);
  productSystemsOuter?.addEventListener("mouseleave", startSystemsAutoplay);

  productSystemsTrack.addEventListener("scroll", onScroll, { passive: true });
  addMediaQueryChangeListener(mq, () => {
    stopSystemsAutoplay();
    renderDots();
    if (mq.matches) {
      updateDotsActive(activeIndexFromScroll());
      startSystemsAutoplay();
    }
  });

  renderDots();
  if (mq.matches) {
    updateDotsActive(activeIndexFromScroll());
    startSystemsAutoplay();
  }

  window.addEventListener(
    "resize",
    () => {
      if (mq.matches) {
        updateDotsActive(activeIndexFromScroll());
      }
    },
    { passive: true }
  );
})();

(function initBackToTop() {
  const btn = document.getElementById("backToTop");
  if (!(btn instanceof HTMLButtonElement)) {
    return;
  }

  const SHOW_AFTER_PX = 400;
  let scrollRaf = 0;

  function updateVisibility() {
    scrollRaf = 0;
    const show = window.scrollY > SHOW_AFTER_PX;
    btn.classList.toggle("is-visible", show);
    btn.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function onScroll() {
    if (scrollRaf) {
      return;
    }
    scrollRaf = window.requestAnimationFrame(updateVisibility);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  updateVisibility();

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
