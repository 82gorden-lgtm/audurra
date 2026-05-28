/**
 * Единая структура навигации: main-nav и левое facet-меню генерируются отсюда.
 * После правок: node tools/sync-navigation.mjs
 */
export const NAV_SECTIONS = [
  {
    id: "what-is-audurra",
    label: "Что такое Audurra?",
    links: [
      { href: "what-is-audurra/index.html", label: "ОБЗОР" },
      { href: "what-is-audurra/abrasives.html", label: "АБРАЗИВЫ" },
      { href: "what-is-audurra/masking.html", label: "МАСКИРОВКА" },
      { href: "what-is-audurra/personal-protection.html", label: "СРЕДСТВА ЗАЩИТЫ" },
      { href: "what-is-audurra/paint-preparation.html", label: "ПОДГОТОВКА К ОКРАСКЕ" },
      { href: "what-is-audurra/substrate-preparation.html", label: "ПОДГОТОВКА ПОДЛОЖКИ" },
      { href: "what-is-audurra/paint-stands-storage-systems.html", label: "СТОЙКИ И ХРАНЕНИЕ" },
      { href: "what-is-audurra/plastic-repair.html", label: "РЕМОНТ ПЛАСТИКА" },
    ],
  },
  {
    id: "working-with-audurra",
    label: "Работа с Audurra?",
    links: [
      { href: "working-with-audurra/index.html", label: "ОБЗОР" },
      { href: "working-with-audurra/tds-sds.html", label: "TDS / SDS" },
      { href: "working-with-audurra/how-to-use-our-products.html", label: "КАК ИСПОЛЬЗОВАТЬ ПРОДУКЦИЮ" },
      { href: "working-with-audurra/publications.html", label: "ПУБЛИКАЦИИ" },
      { href: "working-with-audurra/videos.html", label: "ВИДЕО" },
    ],
  },
  {
    id: "why-audurra",
    label: "Зачем Audurra?",
    links: [
      { href: "why-audurra/index.html", label: "ОБЗОР" },
      { href: "why-audurra/faq.html", label: "ЧАСТЫЕ ВОПРОСЫ" },
    ],
  },
  {
    id: "catalog",
    label: "Каталог",
    links: [
      { href: "catalog/index.html", label: "КАТАЛОГ ТОВАРОВ" },
      {
        href: "documents/Audurra_Catalogue_EN_2025-10.pdf",
        label: "КАТАЛОГ-ПРОСПЕКТ (PDF)",
        external: true,
      },
    ],
  },
  {
    id: "contacts",
    label: "Контакты",
    links: [{ href: "contacts/contacts.html", label: "СВЯЗАТЬСЯ С НАМИ" }],
  },
];

/** Папки страниц с левым меню (facet). */
export const LEFT_NAV_DIRS = NAV_SECTIONS.filter((s) =>
  ["what-is-audurra", "working-with-audurra", "why-audurra"].includes(s.id),
).map((s) => s.id);

export function sectionIdFromPagePath(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  for (const id of LEFT_NAV_DIRS) {
    if (norm.startsWith(`${id}/`)) {
      return id;
    }
  }
  return null;
}

function linkAttrs(link, base) {
  const href = `${base}${link.href}`;
  if (link.external) {
    return `href="${href}" target="_blank" rel="noopener noreferrer nofollow"`;
  }
  return `href="${href}"`;
}

export function renderMainNavPartial(base = "{{BASE}}") {
  const items = NAV_SECTIONS.map(
    (section) => `              <div class="nav-item has-submenu">
                <button class="nav-trigger" type="button" aria-expanded="false">${section.label}</button>
                <div class="submenu-panel">
${section.links
  .map(
    (link) =>
      `                  <a ${linkAttrs(link, base)}>${link.label}</a>`,
  )
  .join("\n")}
                </div>
              </div>`,
  ).join("\n");

  return `            <nav class="main-nav" id="mainNav" aria-label="Главная навигация">
${items}
            </nav>
`;
}

/** Левое меню для страниц вне разделов (демо): все блоки раскрыты. */
export function renderLeftSideNavStatic(base) {
  return renderLeftSideNav(base, null, null, { expandAll: true });
}

export function renderLeftSideNav(base, activeSectionId, pageFile, opts = {}) {
  const expandAll = opts.expandAll === true;
  const blocks = NAV_SECTIONS.map((section) => {
    const overview = section.links[0];
    const expanded = expandAll || section.id === activeSectionId;
    const panelHidden = expanded ? "" : " hidden";
    const expandedClass = expanded ? " facet-block--expanded" : "";
    const ariaExpanded = expanded ? "true" : "false";
    const icon = expanded ? "−" : "+";

    const isHeadingCurrent =
      !expandAll &&
      activeSectionId === section.id &&
      pageFile &&
      overview.href.endsWith(`/${pageFile}`);
    const headingAria = isHeadingCurrent ? ' aria-current="page"' : "";

    /* Контакты: один пункт, без панели (как в Template). */
    if (section.links.length === 1) {
      const contactExtra =
        section.id === "contacts" ? " facet-block--contact" : "";
      return `          <div class="facet-block facet-block--firstlevel-split facet-block--firstlevel-no-sub${contactExtra}" data-nav-section="${section.id}">
            <div class="facet-block-firstlevel">
              <span class="facet-block-expander-spacer" aria-hidden="true"></span>
              <a class="facet-block-heading-link"${headingAria} ${linkAttrs(overview, base)}>${section.label}</a>
            </div>
          </div>`;
    }

    /* L2: без «ОБЗОР» — обзор только в заголовке L1 (facet-block-heading-link). */
    const sublinks = section.links
      .slice(1)
      .map((link) => {
        const isCurrent =
          !expandAll &&
          activeSectionId === section.id &&
          pageFile &&
          link.href.endsWith(`/${pageFile}`);
        const currentClass = isCurrent
          ? "facet-sublink facet-sublink--current"
          : "facet-sublink";
        const aria = isCurrent ? ' aria-current="page"' : "";
        return `                <li><a class="${currentClass}" ${linkAttrs(link, base)}${aria}>${link.label}</a></li>`;
      })
      .join("\n");

    /* L1: слева ± — сворачивание, справа заголовок — ссылка на обзор раздела. */
    return `          <div class="facet-block facet-block--firstlevel-split${expandedClass}" data-nav-section="${section.id}">
            <div class="facet-block-firstlevel">
              <button type="button" class="facet-block-expander" aria-expanded="${ariaExpanded}" data-facet-toggle>
                <span class="facet-toggle-icon" aria-hidden="true">${icon}</span>
              </button>
              <a class="facet-block-heading-link"${headingAria} ${linkAttrs(overview, base)}>${section.label}</a>
            </div>
            <div class="facet-block-panel"${panelHidden}>
              <ul class="facet-sublist">
${sublinks}
              </ul>
            </div>
          </div>`;
  }).join("\n");

  return `      <aside class="col-lg-3 col-md-12 col-sm-12 col-xs-12 gridBorder facetSection" aria-label="Левое меню раздела" data-cromax-facet-sidebar="">
        <nav class="facet-nav-inner" aria-label="Меню страницы">
${blocks}
        </nav>
      </aside>`;
}
